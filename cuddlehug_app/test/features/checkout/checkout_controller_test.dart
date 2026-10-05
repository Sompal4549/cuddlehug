import 'package:cuddlehug_app/core/network/api_exception.dart';
import 'package:cuddlehug_app/core/network/dio_client.dart';
import 'package:cuddlehug_app/core/storage/auth_session.dart';
import 'package:cuddlehug_app/core/storage/secure_store.dart';
import 'package:cuddlehug_app/features/account/data/models/address.dart';
import 'package:cuddlehug_app/features/cart/application/cart_controller.dart';
import 'package:cuddlehug_app/features/cart/data/cart_repository.dart';
import 'package:cuddlehug_app/features/cart/data/models/cart.dart';
import 'package:cuddlehug_app/features/checkout/application/checkout_controller.dart';
import 'package:cuddlehug_app/features/checkout/data/checkout_repository.dart';
import 'package:cuddlehug_app/features/checkout/data/models/payment_intent.dart';
import 'package:cuddlehug_app/features/orders/data/models/order.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

DioClient _client() => DioClient(
  authSession: AuthSession(),
  secureStore: SecureStore(),
  enableLogging: false,
);

const _address = Address(
  id: 'a1',
  fullName: 'Asha Patel',
  phone: '9876543210',
  line1: '12 Cuddle Lane',
  city: 'Pune',
  state: 'Maharashtra',
  pincode: '411001',
  isDefault: true,
);

Map<String, dynamic> _orderJson({
  String id = 'o1',
  String status = 'PENDING',
}) => <String, dynamic>{
  'id': id,
  'orderNumber': 'CH-0001-000123',
  'status': status,
  'paymentStatus': status == 'PENDING' ? 'PENDING' : 'PAID',
  'paymentMethod': 'RAZORPAY',
  'subtotal': '600.00',
  'discountAmount': '0.00',
  'couponCode': null,
  'shippingAmount': '0.00',
  'taxAmount': '108.00',
  'totalAmount': '708.00',
  'currency': 'INR',
  'shippingAddress': null,
  'billingAddress': null,
  'trackingNumber': null,
  'courierName': null,
  'estimatedDelivery': null,
  'cancelReason': null,
  'placedAt': '2026-01-01T10:00:00.000Z',
  'paidAt': null,
  'createdAt': '2026-01-01T10:00:00.000Z',
  'updatedAt': '2026-01-01T10:00:00.000Z',
  'user': <String, dynamic>{
    'id': 'u1',
    'firstName': 'Asha',
    'lastName': 'Patel',
    'email': 'asha@example.com',
    'phone': null,
  },
  'payment': null,
  'items': <Map<String, dynamic>>[],
  'history': <Map<String, dynamic>>[],
};

class _FakeCheckoutRepository extends CheckoutRepository {
  new() : super(_client());

  bool failCreate = false;
  bool failVerify = false;
  bool devMode = false;
  int createCalls = 0;
  int intentCalls = 0;
  int devCompleteCalls = 0;
  String? lastKey;
  String? lastMethod;
  String? lastCoupon;

  @override
  Future<Order> createOrder({
    required String addressId,
    required String paymentMethod,
    String? couponCode,
    String? idempotencyKey,
  }) async {
    createCalls++;
    lastKey = idempotencyKey;
    lastMethod = paymentMethod;
    lastCoupon = couponCode;
    if (failCreate) {
      throw const ApiException(
        message: 'Only 2 left for Giant Teddy Bear',
        code: 'OUT_OF_STOCK',
        status: 409,
      );
    }
    return Order.fromJson(
      _orderJson(status: paymentMethod == 'COD' ? 'CONFIRMED' : 'PENDING'),
    );
  }

  @override
  Future<PaymentIntent> createPaymentIntent(String orderId) async {
    intentCalls++;
    if (devMode) {
      return PaymentIntent(
        devMode: true,
        orderId: orderId,
        orderNumber: 'CH-0001-000123',
        amount: 70800,
        amountDisplay: '708.00',
        currency: 'INR',
      );
    }
    return PaymentIntent(
      devMode: false,
      keyId: 'rzp_test_key',
      razorpayOrderId: 'order_abc',
      orderId: orderId,
      orderNumber: 'CH-0001-000123',
      amount: 70800,
      amountDisplay: '708.00',
      currency: 'INR',
    );
  }

  @override
  Future<Order> verifyPayment(PaymentVerifyPayload payload) async {
    if (failVerify) {
      throw const ApiException(
        message: 'Payment verification failed',
        code: 'PAYMENT_SIGNATURE_INVALID',
        status: 400,
      );
    }
    return Order.fromJson(_orderJson(status: 'CONFIRMED'));
  }

  @override
  Future<Order> devComplete(String orderId) async {
    devCompleteCalls++;
    return Order.fromJson(_orderJson(status: 'CONFIRMED'));
  }

  @override
  Future<PaymentStatusInfo> paymentStatus(String orderId) async =>
      const PaymentStatusInfo(
        orderNumber: 'CH-0001-000123',
        paymentStatus: 'PAID',
        status: 'CONFIRMED',
      );
}

class _FakeCartRepository extends CartRepository {
  new() : super(_client());

  @override
  Future<Cart> getCart() async => Cart.fromJson(const <String, dynamic>{
    'id': 'cart1',
    'itemCount': 2,
    'items': <Map<String, dynamic>>[
      <String, dynamic>{
        'id': 'line1',
        'variantId': 'v1',
        'quantity': 2,
        'maxQuantity': 10,
        'inStock': true,
        'available': 7,
        'product': <String, dynamic>{
          'id': 'p1',
          'name': 'Giant Teddy Bear',
          'slug': 'giant-teddy-bear',
          'image': null,
          'status': 'ACTIVE',
        },
        'variant': <String, dynamic>{
          'id': 'v1',
          'size': 'GIANT',
          'color': 'BROWN',
          'sku': 'TDY-GI-BRN',
          'price': '300.00',
          'mrp': '499.00',
        },
      },
    ],
    'coupon': <String, dynamic>{
      'code': 'CUDDLE30',
      'description': null,
      'type': 'FIXED',
      'value': '30.00',
      'discount': '30.00',
    },
    'summary': <String, dynamic>{
      'subtotal': '600.00',
      'mrpTotal': '998.00',
      'productSavings': '398.00',
      'couponDiscount': '30.00',
      'discountedSubtotal': '570.00',
      'shipping': '0.00',
      'tax': '108.00',
      'total': '678.00',
      'freeShippingUnlocked': true,
      'lines': <Map<String, dynamic>>[],
    },
  });
}

void main() {
  late _FakeCheckoutRepository repo;
  late ProviderContainer container;

  setUp(() {
    repo = _FakeCheckoutRepository();
    container = ProviderContainer(
      overrides: [
        checkoutRepositoryProvider.overrideWithValue(repo),
        cartRepositoryProvider.overrideWithValue(_FakeCartRepository()),
      ],
    );
    addTearDown(container.dispose);
  });

  CheckoutController controller() => container.read(checkoutProvider.notifier);
  CheckoutState state() => container.read(checkoutProvider);

  Future<void> prime() async {
    container.read(cartProvider);
    await Future<void>.delayed(Duration.zero);
    controller().selectAddress(_address);
  }

  test('COD order completes immediately with an idempotency key', () async {
    await prime();
    controller().selectMethod(PaymentMethod.cod);
    await controller().placeOrder();
    expect(state().stage, CheckoutStage.completed);
    expect(state().completedOrder, isNotNull);
    expect(repo.createCalls, 1);
    expect(repo.lastMethod, 'COD');
    expect(repo.lastKey, isNotNull);
    expect(repo.lastKey!.length, lessThanOrEqualTo(100));
    expect(repo.lastCoupon, 'CUDDLE30', reason: 'coupon rides along');
    expect(state().idempotencyKey, isNull, reason: 'key cleared on success');
  });

  test('Razorpay order parks on awaitingGateway with an intent', () async {
    await prime();
    await controller().placeOrder();
    expect(state().stage, CheckoutStage.awaitingGateway);
    expect(state().pendingIntent, isNotNull);
    expect(state().pendingIntent!.razorpayOrderId, 'order_abc');
    expect(state().completedOrder, isNull);
    expect(repo.intentCalls, 1);
    expect(repo.devCompleteCalls, 0);
  });

  test('verify success completes the order', () async {
    await prime();
    await controller().placeOrder();
    await controller().verifyPayment(
      const PaymentVerifyPayload(
        razorpayOrderId: 'order_abc',
        razorpayPaymentId: 'pay_123',
        razorpaySignature: 'sig',
      ),
    );
    expect(state().stage, CheckoutStage.completed);
    expect(state().completedOrder!.status, 'CONFIRMED');
  });

  test('invalid signature fails with the backend message', () async {
    await prime();
    await controller().placeOrder();
    repo.failVerify = true;
    await controller().verifyPayment(
      const PaymentVerifyPayload(
        razorpayOrderId: 'order_abc',
        razorpayPaymentId: 'pay_123',
        razorpaySignature: 'bad',
      ),
    );
    expect(state().stage, CheckoutStage.failed);
    expect((state().error! as ApiException).code, 'PAYMENT_SIGNATURE_INVALID');
  });

  test(
    'cancelled gateway keeps the order for retry (single createOrder)',
    () async {
      await prime();
      await controller().placeOrder();
      controller().cancelPayment();
      expect(state().stage, CheckoutStage.failed);
      expect(state().placedOrder, isNotNull);
      expect((state().error! as ApiException).code, 'PAYMENT_CANCELLED');

      await controller().retryPayment();
      expect(state().stage, CheckoutStage.awaitingGateway);
      expect(repo.createCalls, 1, reason: 'no second order on retry');
      expect(repo.intentCalls, 2);
    },
  );

  test('dev mode completes through dev-complete', () async {
    repo.devMode = true;
    await prime();
    await controller().placeOrder();
    expect(repo.devCompleteCalls, 1);
    expect(state().stage, CheckoutStage.completed);
    expect(state().completedOrder!.paymentStatus, 'PAID');
  });

  test('missing address fails locally without calling the backend', () async {
    container.read(checkoutProvider);
    await controller().placeOrder();
    expect(state().stage, CheckoutStage.failed);
    expect(
      (state().error! as ApiException).message,
      'Select a delivery address',
    );
    expect(repo.createCalls, 0);
  });

  test(
    'order-create failure surfaces OUT_OF_STOCK and clears nothing',
    () async {
      await prime();
      repo.failCreate = true;
      await controller().placeOrder();
      expect(state().stage, CheckoutStage.failed);
      expect((state().error! as ApiException).code, 'OUT_OF_STOCK');
      expect(state().placedOrder, isNull);
      expect(state().idempotencyKey, isNotNull, reason: 'reuse on retry');
    },
  );
}
