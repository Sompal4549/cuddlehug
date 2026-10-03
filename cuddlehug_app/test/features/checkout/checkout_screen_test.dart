import 'package:cuddlehug_app/core/data/store_settings.dart';
import 'package:cuddlehug_app/core/network/api_exception.dart';
import 'package:cuddlehug_app/core/network/dio_client.dart';
import 'package:cuddlehug_app/core/storage/auth_session.dart';
import 'package:cuddlehug_app/core/storage/secure_store.dart';
import 'package:cuddlehug_app/features/account/application/addresses_controller.dart';
import 'package:cuddlehug_app/features/account/data/models/address.dart';
import 'package:cuddlehug_app/features/cart/data/cart_repository.dart';
import 'package:cuddlehug_app/features/cart/data/models/cart.dart';
import 'package:cuddlehug_app/features/checkout/data/checkout_repository.dart';
import 'package:cuddlehug_app/features/checkout/data/models/payment_intent.dart';
import 'package:cuddlehug_app/features/checkout/presentation/checkout_screen.dart';
import 'package:cuddlehug_app/features/orders/data/models/order.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

DioClient _client() => DioClient(
      authSession: AuthSession(),
      secureStore: SecureStore(),
      enableLogging: false,
    );

class _PreloadedAddresses extends AddressesController {
  @override
  AddressesState build() => const AddressesState(
        items: [
          Address(
            id: 'a1',
            fullName: 'Asha Patel',
            phone: '9876543210',
            line1: '12 Cuddle Lane',
            city: 'Pune',
            state: 'Maharashtra',
            pincode: '411001',
            isDefault: true,
          ),
        ],
      );
}

class _FailingCheckoutRepository extends CheckoutRepository {
  new() : super(_client());

  @override
  Future<Order> createOrder({
    required String addressId,
    required String paymentMethod,
    String? couponCode,
    String? idempotencyKey,
  }) async {
    throw const ApiException(
      message: 'Only 2 left for Giant Teddy Bear',
      code: 'OUT_OF_STOCK',
      status: 409,
    );
  }

  @override
  Future<PaymentIntent> createPaymentIntent(String orderId) async =>
      throw StateError('not reached in this test');
}

class _EmptyCartRepository extends CartRepository {
  new() : super(_client());

  @override
  Future<Cart> getCart() async => Cart.fromJson(const <String, dynamic>{
        'id': 'cart1',
        'itemCount': 0,
        'items': <Map<String, dynamic>>[],
        'coupon': null,
        'summary': <String, dynamic>{
          'subtotal': '0.00',
          'mrpTotal': '0.00',
          'productSavings': '0.00',
          'couponDiscount': '0.00',
          'discountedSubtotal': '0.00',
          'shipping': '0.00',
          'tax': '0.00',
          'total': '0.00',
          'freeShippingUnlocked': false,
          'lines': <Map<String, dynamic>>[],
        },
      });
}

Future<void> _pump(WidgetTester tester) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        addressesProvider.overrideWith(_PreloadedAddresses.new),
        storeSettingsProvider.overrideWith(
          (ref) async => const StoreSettings(<String, dynamic>{
            'payment.razorpayEnabled': true,
            'shipping.codEnabled': true,
          }),
        ),
        checkoutRepositoryProvider
            .overrideWithValue(_FailingCheckoutRepository()),
        cartRepositoryProvider.overrideWithValue(_EmptyCartRepository()),
      ],
      child: const MaterialApp(home: CheckoutScreen()),
    ),
  );
  // Auto-select default address runs post-frame.
  await tester.pump();
  await tester.pump();
}

void main() {
  testWidgets('renders sections and enables the pay button with an address',
      (tester) async {
    await _pump(tester);
    expect(find.text('Delivery address'), findsOneWidget);
    expect(find.text('Payment method'), findsOneWidget);
    expect(find.text('Order summary'), findsOneWidget);
    expect(find.textContaining('Asha Patel'), findsOneWidget);
    expect(find.text('Pay now'), findsOneWidget);

    final payButton = tester.widget<ElevatedButton>(
      find.widgetWithText(ElevatedButton, 'Pay now'),
    );
    expect(payButton.onPressed, isNotNull, reason: 'default address preselected');
  });

  testWidgets('switching to cash on delivery relabels the action',
      (tester) async {
    await _pump(tester);
    await tester.tap(find.text('Cash on delivery'));
    await tester.pump();
    expect(find.text('Place order'), findsOneWidget);
    expect(find.text('Pay now'), findsNothing);
  });

  testWidgets('order-create failure surfaces the backend message',
      (tester) async {
    await _pump(tester);
    await tester.tap(find.text('Cash on delivery'));
    await tester.pump();
    await tester.tap(find.widgetWithText(ElevatedButton, 'Place order'));
    await tester.pump();
    await tester.pump();
    expect(find.text('Only 2 left for Giant Teddy Bear'), findsOneWidget);
  });
}
