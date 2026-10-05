import 'dart:async';
import 'dart:math';

import 'package:cuddlehug_app/core/network/api_exception.dart';
import 'package:cuddlehug_app/features/account/data/models/address.dart';
import 'package:cuddlehug_app/features/cart/application/cart_controller.dart';
import 'package:cuddlehug_app/features/checkout/data/checkout_repository.dart';
import 'package:cuddlehug_app/features/checkout/data/models/payment_intent.dart';
import 'package:cuddlehug_app/features/orders/application/orders_controller.dart';
import 'package:cuddlehug_app/features/orders/data/models/order.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Payment methods supported by `createOrderSchema`.
enum PaymentMethod {
  razorpay('RAZORPAY'),
  cod('COD');

  new(this.queryValue);

  final String queryValue;
}

/// Linear checkout progress — mirrors the web stages
/// ("Placing your order…", "Confirming test payment…", "Verifying
/// payment…").
enum CheckoutStage {
  idle,
  placing,
  confirming,
  awaitingGateway,
  verifying,
  completed,
  failed,
}

@immutable
class CheckoutState {
  const new({
    this.address,
    this.method = PaymentMethod.razorpay,
    this.stage = CheckoutStage.idle,
    this.placedOrder,
    this.pendingIntent,
    this.completedOrder,
    this.error,
    this.idempotencyKey,
  });

  final Address? address;
  final PaymentMethod method;
  final CheckoutStage stage;

  /// Order created on the backend but payment not finished yet. Kept so a
  /// retry never creates a second order (the same `Idempotency-Key` is
  /// reused while it is set).
  final Order? placedOrder;
  final PaymentIntent? pendingIntent;
  final Order? completedOrder;
  final Object? error;
  final String? idempotencyKey;

  bool get busy =>
      stage == CheckoutStage.placing ||
      stage == CheckoutStage.confirming ||
      stage == CheckoutStage.verifying;
  bool get canPlaceOrder => address != null && address!.id != null && !busy;

  CheckoutState copyWith({
    Address? address,
    PaymentMethod? method,
    CheckoutStage? stage,
    Order? placedOrder,
    PaymentIntent? pendingIntent,
    Order? completedOrder,
    Object? error,
    String? idempotencyKey,
    bool clearAddress = false,
    bool clearPlaced = false,
    bool clearIntent = false,
    bool clearCompleted = false,
    bool clearError = false,
    bool clearKey = false,
  }) => CheckoutState(
    address: clearAddress ? null : address ?? this.address,
    method: method ?? this.method,
    stage: stage ?? this.stage,
    placedOrder: clearPlaced ? null : placedOrder ?? this.placedOrder,
    pendingIntent: clearIntent ? null : pendingIntent ?? this.pendingIntent,
    completedOrder: clearCompleted
        ? null
        : completedOrder ?? this.completedOrder,
    error: clearError ? null : error ?? this.error,
    idempotencyKey: clearKey ? null : idempotencyKey ?? this.idempotencyKey,
  );
}

/// Drives order placement and the payment handoff. The Razorpay sheet
/// itself lives in the screen (it needs a platform view context); the
/// controller exposes [CheckoutState.pendingIntent] for the UI to open and
/// then calls back with [verifyPayment]/[cancelPayment].
class CheckoutController extends Notifier<CheckoutState> {
  final Random _random = Random();

  @override
  CheckoutState build() => const CheckoutState();

  /// Fresh screen entry — clears a previous run's outcome.
  void reset() {
    if (state.stage == CheckoutStage.completed ||
        state.stage == CheckoutStage.failed) {
      state = const CheckoutState();
    }
  }

  void selectAddress(Address address) {
    state = state.copyWith(address: address, clearError: true);
  }

  void selectMethod(PaymentMethod method) {
    if (state.busy) return;
    state = state.copyWith(
      method: method,
      stage: CheckoutStage.idle,
      clearIntent: true,
      clearError: true,
    );
  }

  /// Creates the order, then runs the payment leg (COD completes
  /// immediately; Razorpay opens the gateway via `pendingIntent`, unless
  /// the backend is in dev mode where `dev-complete` finishes it).
  Future<void> placeOrder() async {
    final addressId = state.address?.id;
    if (addressId == null) {
      state = state.copyWith(
        stage: CheckoutStage.failed,
        error: const ApiException(
          message: 'Select a delivery address',
          code: 'BAD_REQUEST',
          status: 400,
        ),
      );
      return;
    }
    final key =
        state.idempotencyKey ??
        'ch-app-${DateTime.now().microsecondsSinceEpoch}-'
            '${_random.nextInt(0x7fffffff)}';
    state = state.copyWith(
      stage: CheckoutStage.placing,
      idempotencyKey: key,
      clearError: true,
      clearIntent: true,
      clearCompleted: true,
    );
    try {
      final cart = ref.read(cartProvider).cart;
      final order = await _repo.createOrder(
        addressId: addressId,
        paymentMethod: state.method.queryValue,
        couponCode: cart?.coupon?.code,
        idempotencyKey: key,
      );
      state = state.copyWith(placedOrder: order);
      await _startPayment(order);
    } on Object catch (error) {
      state = state.copyWith(stage: CheckoutStage.failed, error: error);
    }
  }

  /// Re-runs the payment leg for an order that already exists (gateway
  /// dismissed, network hiccup) — never creates a second order.
  Future<void> retryPayment() async {
    final order = state.placedOrder;
    if (order == null) {
      await placeOrder();
      return;
    }
    state = state.copyWith(
      stage: CheckoutStage.placing,
      clearError: true,
      clearIntent: true,
    );
    try {
      await _startPayment(order);
    } on Object catch (error) {
      state = state.copyWith(stage: CheckoutStage.failed, error: error);
    }
  }

  Future<void> _startPayment(Order order) async {
    if (state.method == PaymentMethod.cod) {
      _complete(order);
      return;
    }
    final intent = await _repo.createPaymentIntent(order.id);
    if (intent.devMode) {
      state = state.copyWith(stage: CheckoutStage.confirming);
      final confirmed = await _repo.devComplete(intent.orderId);
      _complete(confirmed);
      return;
    }
    state = state.copyWith(
      stage: CheckoutStage.awaitingGateway,
      pendingIntent: intent,
    );
  }

  /// Called by the screen with the Razorpay handler response.
  Future<void> verifyPayment(PaymentVerifyPayload payload) async {
    state = state.copyWith(stage: CheckoutStage.verifying, clearError: true);
    try {
      final order = await _repo.verifyPayment(payload);
      _complete(order);
    } on Object catch (error) {
      state = state.copyWith(stage: CheckoutStage.failed, error: error);
    }
  }

  /// Gateway dismissed or failed — the created order stays PENDING and a
  /// retry reuses it.
  void cancelPayment() {
    state = state.copyWith(
      stage: CheckoutStage.failed,
      error: const ApiException(
        message: 'Payment cancelled',
        code: 'PAYMENT_CANCELLED',
        status: 400,
      ),
      clearIntent: true,
    );
  }

  void clearError() => state = state.copyWith(clearError: true);

  void _complete(Order order) {
    state = state.copyWith(
      stage: CheckoutStage.completed,
      completedOrder: order,
      clearIntent: true,
      clearKey: true,
      clearError: true,
    );
    // The server emptied the cart and recorded the order — refresh both.
    unawaited(ref.read(cartProvider.notifier).load(force: true));
    ref
      ..invalidate(ordersProvider)
      ..invalidate(orderStatsProvider);
  }

  CheckoutRepository get _repo => ref.read(checkoutRepositoryProvider);
}

final checkoutProvider = NotifierProvider<CheckoutController, CheckoutState>(
  CheckoutController.new,
);
