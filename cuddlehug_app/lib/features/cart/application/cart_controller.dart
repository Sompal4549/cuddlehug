import 'dart:async';

import 'package:cuddlehug_app/features/auth/application/auth_controller.dart';
import 'package:cuddlehug_app/features/cart/data/cart_repository.dart';
import 'package:cuddlehug_app/features/cart/data/models/cart.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Cart state. Works for guests (via the `ch_sid` cookie) and signed-in
/// users; [busyVariantIds] tracks per-line mutations so steppers can
/// disable without blocking the whole screen.
@immutable
class CartState {
  const new({
    this.cart,
    this.loading = false,
    this.error,
    this.busyVariantIds = const {},
    this.couponBusy = false,
  });

  final Cart? cart;
  final bool loading;
  final Object? error;
  final Set<String> busyVariantIds;
  final bool couponBusy;

  int get itemCount => cart?.itemCount ?? 0;
  bool get hasLoaded => cart != null;
  bool get isEmpty => cart != null && cart!.isEmpty;
  bool isBusy(String variantId) => busyVariantIds.contains(variantId);

  CartState copyWith({
    Cart? cart,
    bool? loading,
    Object? error,
    Set<String>? busyVariantIds,
    bool? couponBusy,
    bool clearError = false,
    bool clearCart = false,
  }) => CartState(
    cart: clearCart ? null : cart ?? this.cart,
    loading: loading ?? this.loading,
    error: clearError ? null : error ?? this.error,
    busyVariantIds: busyVariantIds ?? this.busyVariantIds,
    couponBusy: couponBusy ?? this.couponBusy,
  );
}

/// Cart mutations return the server's full cart DTO, so each call replaces
/// state wholesale — the backend is the single pricing source of truth.
/// Rebuilds on auth flips because login/register merges the guest cart
/// server-side (the client must re-read it).
class CartController extends Notifier<CartState> {
  @override
  CartState build() {
    ref.watch(authControllerProvider.select((auth) => auth.isAuthenticated));
    scheduleMicrotask(load);
    return const CartState(loading: true);
  }

  Future<void> load({bool force = false}) async {
    if (!force && state.hasLoaded) return;
    state = state.copyWith(loading: true, clearError: true);
    try {
      final cart = await _repo.getCart();
      state = CartState(cart: cart);
    } on Object catch (error) {
      state = state.copyWith(loading: false, error: error);
    }
  }

  Future<Cart> addItem(String variantId, {int quantity = 1}) => _mutate(
    variantId,
    () => _repo.addItem(variantId: variantId, quantity: quantity),
  );

  Future<Cart> updateQuantity(String variantId, int quantity) => _mutate(
    variantId,
    () => _repo.updateItem(variantId: variantId, quantity: quantity),
  );

  Future<Cart> removeItem(String itemId, {required String variantId}) =>
      _mutate(variantId, () => _repo.removeItem(itemId));

  /// Throws the backend's `INVALID_COUPON` message for the UI to show.
  Future<Cart> applyCoupon(String code) async {
    state = state.copyWith(couponBusy: true, clearError: true);
    try {
      final cart = await _repo.applyCoupon(code);
      state = CartState(cart: cart);
      return cart;
    } on Object catch (error) {
      state = state.copyWith(couponBusy: false, error: error);
      rethrow;
    }
  }

  Future<Cart> removeCoupon() async {
    state = state.copyWith(couponBusy: true, clearError: true);
    try {
      final cart = await _repo.removeCoupon();
      state = CartState(cart: cart);
      return cart;
    } on Object catch (error) {
      state = state.copyWith(couponBusy: false, error: error);
      rethrow;
    }
  }

  void clearError() => state = state.copyWith(clearError: true);

  Future<Cart> _mutate(String variantId, Future<Cart> Function() run) async {
    state = state.copyWith(
      busyVariantIds: {...state.busyVariantIds, variantId},
      clearError: true,
    );
    try {
      final cart = await run();
      state = CartState(cart: cart);
      return cart;
    } on Object catch (error) {
      state = state.copyWith(
        busyVariantIds: {...state.busyVariantIds}..remove(variantId),
        error: error,
      );
      rethrow;
    }
  }

  CartRepository get _repo => ref.read(cartRepositoryProvider);
}

final cartProvider = NotifierProvider<CartController, CartState>(
  CartController.new,
);
