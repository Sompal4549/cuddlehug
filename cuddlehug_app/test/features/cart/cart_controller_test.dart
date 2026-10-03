import 'package:cuddlehug_app/core/network/api_exception.dart';
import 'package:cuddlehug_app/core/network/dio_client.dart';
import 'package:cuddlehug_app/core/storage/auth_session.dart';
import 'package:cuddlehug_app/core/storage/secure_store.dart';
import 'package:cuddlehug_app/features/cart/application/cart_controller.dart';
import 'package:cuddlehug_app/features/cart/data/cart_repository.dart';
import 'package:cuddlehug_app/features/cart/data/models/cart.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> _cartJson({
  int itemCount = 2,
  int quantity = 2,
  Map<String, dynamic>? coupon,
}) =>
    <String, dynamic>{
      'id': 'cart1',
      'itemCount': itemCount,
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
      'coupon': coupon,
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
  new()
      : super(
          DioClient(
            authSession: AuthSession(),
            secureStore: SecureStore(),
            enableLogging: false,
          ),
        );

  bool failGet = false;
  bool failAdd = false;
  bool failCoupon = false;
  Map<String, dynamic> current = _cartJson();
  final List<String> calls = [];

  @override
  Future<Cart> getCart() async {
    if (failGet) {
      throw const ApiException(
        message: 'offline',
        code: 'INTERNAL_ERROR',
        status: 500,
      );
    }
    calls.add('get');
    return Cart.fromJson(current);
  }

  @override
  Future<Cart> addItem({required String variantId, int quantity = 1}) async {
    if (failAdd) {
      throw const ApiException(
        message: 'Product is out of stock',
        code: 'OUT_OF_STOCK',
        status: 409,
      );
    }
    calls.add('add:$variantId:$quantity');
    current = _cartJson(quantity: quantity);
    return Cart.fromJson(current);
  }

  @override
  Future<Cart> updateItem({
    required String variantId,
    required int quantity,
  }) async {
    calls.add('update:$variantId:$quantity');
    current = _cartJson(quantity: quantity);
    return Cart.fromJson(current);
  }

  @override
  Future<Cart> removeItem(String itemId) async {
    calls.add('remove:$itemId');
    current = <String, dynamic>{
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
    };
    return Cart.fromJson(current);
  }

  @override
  Future<Cart> applyCoupon(String code) async {
    if (failCoupon) {
      throw const ApiException(
        message: 'This coupon code does not exist',
        code: 'INVALID_COUPON',
        status: 400,
      );
    }
    calls.add('coupon:$code');
    current = _cartJson(
      coupon: <String, dynamic>{
        'code': code,
        'description': null,
        'type': 'FIXED',
        'value': '30.00',
        'discount': '30.00',
      },
    );
    return Cart.fromJson(current);
  }

  @override
  Future<Cart> removeCoupon() async {
    calls.add('coupon:remove');
    current = _cartJson();
    return Cart.fromJson(current);
  }
}

void main() {
  late _FakeCartRepository repo;
  late ProviderContainer container;

  setUp(() {
    repo = _FakeCartRepository();
    container = ProviderContainer(
      overrides: [cartRepositoryProvider.overrideWithValue(repo)],
    );
    addTearDown(container.dispose);
  });

  CartController controller() => container.read(cartProvider.notifier);
  CartState state() => container.read(cartProvider);

  test('loads the cart on first read', () async {
    container.read(cartProvider);
    await Future<void>.delayed(Duration.zero);
    expect(state().hasLoaded, isTrue);
    expect(state().cart!.itemCount, 2);
    expect(state().loading, isFalse);
    expect(repo.calls, ['get']);
  });

  test('addItem replaces state with the server cart', () async {
    container.read(cartProvider);
    await Future<void>.delayed(Duration.zero);
    await controller().addItem('v1', quantity: 3);
    expect(repo.calls, contains('add:v1:3'));
    expect(state().cart!.items.first.quantity, 3);
    expect(state().busyVariantIds, isEmpty);
  });

  test('failed addItem rethrows, records the error and clears busy flags',
      () async {
    container.read(cartProvider);
    await Future<void>.delayed(Duration.zero);
    repo.failAdd = true;
    await expectLater(
      controller().addItem('v1'),
      throwsA(isA<ApiException>()),
    );
    expect(state().busyVariantIds, isEmpty);
    expect(state().error, isA<ApiException>());
    expect(state().cart!.items.first.quantity, 2, reason: 'cart unchanged');
  });

  test('updateQuantity ships the new quantity', () async {
    container.read(cartProvider);
    await Future<void>.delayed(Duration.zero);
    await controller().updateQuantity('v1', 5);
    expect(repo.calls, contains('update:v1:5'));
    expect(state().cart!.items.first.quantity, 5);
  });

  test('removeItem empties the cart', () async {
    container.read(cartProvider);
    await Future<void>.delayed(Duration.zero);
    await controller().removeItem('line1', variantId: 'v1');
    expect(state().cart!.isEmpty, isTrue);
    expect(state().itemCount, 0);
  });

  test('applyCoupon stores the applied coupon', () async {
    container.read(cartProvider);
    await Future<void>.delayed(Duration.zero);
    final cart = await controller().applyCoupon('CUDDLE30');
    expect(cart.coupon!.code, 'CUDDLE30');
    expect(state().cart!.coupon!.code, 'CUDDLE30');
    expect(state().couponBusy, isFalse);
    expect(state().error, isNull);
  });

  test('invalid coupon rethrows the backend message', () async {
    container.read(cartProvider);
    await Future<void>.delayed(Duration.zero);
    repo.failCoupon = true;
    await expectLater(
      controller().applyCoupon('NOPE'),
      throwsA(
        isA<ApiException>()
            .having((e) => e.message, 'message', 'This coupon code does not exist'),
      ),
    );
    expect(state().couponBusy, isFalse);
    expect(state().cart!.coupon, isNull);
  });

  test('removeCoupon clears the coupon', () async {
    container.read(cartProvider);
    await Future<void>.delayed(Duration.zero);
    await controller().applyCoupon('CUDDLE30');
    await controller().removeCoupon();
    expect(state().cart!.coupon, isNull);
    expect(repo.calls, contains('coupon:remove'));
  });

  test('load failure surfaces an error and keeps the cart unloaded', () async {
    repo.failGet = true;
    container.read(cartProvider);
    await Future<void>.delayed(Duration.zero);
    expect(state().error, isA<ApiException>());
    expect(state().cart, isNull);
  });

  test('clearError drops the current error', () async {
    repo.failGet = true;
    container.read(cartProvider);
    await Future<void>.delayed(Duration.zero);
    expect(state().error, isNotNull);
    controller().clearError();
    expect(state().error, isNull);
  });
}
