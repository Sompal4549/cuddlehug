import 'package:cuddlehug_app/core/network/dio_client.dart';
import 'package:cuddlehug_app/core/storage/auth_session.dart';
import 'package:cuddlehug_app/core/storage/secure_store.dart';
import 'package:cuddlehug_app/features/cart/cart_screen.dart';
import 'package:cuddlehug_app/features/cart/data/cart_repository.dart';
import 'package:cuddlehug_app/features/cart/data/models/cart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> _cartJson({int quantity = 2}) => <String, dynamic>{
  'id': 'cart1',
  'itemCount': quantity,
  'items': [
    {
      'id': 'line1',
      'variantId': 'v1',
      'quantity': quantity,
      'maxQuantity': 10,
      'inStock': true,
      'available': 7,
      'product': {
        'id': 'p1',
        'name': 'Giant Teddy Bear',
        'slug': 'giant-teddy-bear',
        'image': null,
        'status': 'ACTIVE',
      },
      'variant': {
        'id': 'v1',
        'size': 'GIANT',
        'color': 'BROWN',
        'sku': 'TDY-GI-BRN',
        'price': '300.00',
        'mrp': '499.00',
      },
    },
  ],
  'coupon': null,
  'summary': <String, dynamic>{
    'subtotal': '${quantity * 300}.00',
    'mrpTotal': '${quantity * 499}.00',
    'productSavings': '${(499 - 300) * quantity}.00',
    'couponDiscount': '0.00',
    'discountedSubtotal': '${quantity * 300}.00',
    'shipping': '0.00',
    'tax': '0.00',
    'total': '${quantity * 300}.00',
    'freeShippingUnlocked': true,
    'lines': <Map<String, dynamic>>[],
  },
};

class _FakeCartRepository extends CartRepository {
  new({this.startQuantity = 2})
    : super(
        DioClient(
          authSession: AuthSession(),
          secureStore: SecureStore(),
          enableLogging: false,
        ),
      );

  bool empty = false;
  final int startQuantity;
  final List<String> calls = [];

  @override
  Future<Cart> getCart() async {
    if (empty) {
      return Cart.fromJson(const <String, dynamic>{
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
    return Cart.fromJson(_cartJson(quantity: startQuantity));
  }

  @override
  Future<Cart> updateItem({
    required String variantId,
    required int quantity,
  }) async {
    calls.add('update:$variantId:$quantity');
    return Cart.fromJson(_cartJson(quantity: quantity));
  }

  @override
  Future<Cart> removeItem(String itemId) async {
    calls.add('remove:$itemId');
    return Cart.fromJson(const <String, dynamic>{
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
}

Future<Widget> _app(_FakeCartRepository repo) async => ProviderScope(
  overrides: [cartRepositoryProvider.overrideWithValue(repo)],
  child: const MaterialApp(home: CartScreen()),
);

Future<void> _pumpLoaded(WidgetTester tester, _FakeCartRepository repo) async {
  await tester.pumpWidget(await _app(repo));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 10));
}

void main() {
  testWidgets('shows the empty state when the cart has no items', (
    tester,
  ) async {
    final repo = _FakeCartRepository()..empty = true;
    await _pumpLoaded(tester, repo);
    expect(find.text('Your cart is empty'), findsOneWidget);
    expect(find.text('Start shopping'), findsOneWidget);
    expect(find.text('Checkout'), findsNothing);
  });

  testWidgets('renders line items and the server summary', (tester) async {
    await _pumpLoaded(tester, _FakeCartRepository());
    expect(find.text('Giant Teddy Bear'), findsOneWidget);
    expect(find.text('GIANT / BROWN'), findsOneWidget);
    expect(find.text('Subtotal'), findsOneWidget);
    expect(find.text('Total'), findsOneWidget);
    expect(find.text('Checkout'), findsOneWidget);
    expect(find.text('₹600.00'), findsWidgets);
  });

  testWidgets('plus stepper increases the quantity', (tester) async {
    final repo = _FakeCartRepository();
    await _pumpLoaded(tester, repo);
    await tester.tap(find.byIcon(Icons.add_rounded));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 10));
    expect(repo.calls, contains('update:v1:3'));
    expect(find.text('3'), findsWidgets);
  });

  testWidgets('minus at quantity one removes the line', (tester) async {
    final repo = _FakeCartRepository(startQuantity: 1);
    await _pumpLoaded(tester, repo);
    await tester.tap(find.byIcon(Icons.delete_outline_rounded));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 10));
    expect(repo.calls, contains('remove:line1'));
  });
}
