import 'package:cuddlehug_app/features/cart/data/models/cart.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  Map<String, dynamic> cartJson({
    int itemCount = 3,
    String total = '672.60',
    bool freeShipping = true,
    Map<String, dynamic>? coupon,
  }) => <String, dynamic>{
    'id': 'cart1',
    'itemCount': itemCount,
    'items': [
      {
        'id': 'line1',
        'variantId': 'v1',
        'quantity': 2,
        'maxQuantity': 10,
        'inStock': true,
        'available': 7,
        'product': {
          'id': 'p1',
          'name': 'Giant Teddy Bear',
          'slug': 'giant-teddy-bear',
          'image': '/images/teddy.jpg',
          'status': 'ACTIVE',
        },
        'variant': {
          'id': 'v1',
          'size': 'GIANT',
          'color': 'BROWN',
          'sku': 'TDY-GI-BRN',
          'price': '299.00',
          'mrp': '499.00',
        },
      },
    ],
    'coupon': coupon,
    'summary': {
      'subtotal': '598.00',
      'mrpTotal': '998.00',
      'productSavings': '400.00',
      'couponDiscount': '30.00',
      'discountedSubtotal': '568.00',
      'shipping': '0.00',
      'tax': '104.60',
      'total': total,
      'freeShippingUnlocked': freeShipping,
      'lines': [
        {
          'variantId': 'v1',
          'quantity': 2,
          'unitPrice': '299.00',
          'mrp': '499.00',
          'lineTotal': '598.00',
          'lineMrpTotal': '998.00',
          'savings': '400.00',
        },
      ],
    },
  };

  test('parses the full cart DTO', () {
    final cart = Cart.fromJson(cartJson());
    expect(cart.id, 'cart1');
    expect(cart.itemCount, 3);
    expect(cart.isEmpty, isFalse);
    expect(cart.items, hasLength(1));

    final item = cart.items.first;
    expect(item.id, 'line1');
    expect(item.variant.label, 'GIANT / BROWN');
    expect(item.variant.priceMoney.minorUnits, 29900);
    expect(item.product.name, 'Giant Teddy Bear');
    expect(item.lineTotal.minorUnits, 59800);
  });

  test('summary exposes money getters and totals', () {
    final cart = Cart.fromJson(cartJson());
    final summary = cart.summary;
    expect(summary.subtotalMoney.minorUnits, 59800);
    expect(summary.savingsMoney.minorUnits, 40000);
    expect(summary.couponMoney.minorUnits, 3000);
    expect(summary.taxMoney.minorUnits, 10460);
    expect(summary.totalMoney.minorUnits, 67260);
    expect(summary.freeShippingUnlocked, isTrue);
    expect(summary.lines, hasLength(1));
    expect(summary.lines.first.unitPrice, '299.00');
  });

  test('parses an applied coupon', () {
    final cart = Cart.fromJson(
      cartJson(
        coupon: <String, dynamic>{
          'code': 'CUDDLE10',
          'description': '10% off',
          'type': 'PERCENTAGE',
          'value': '10.00',
          'discount': '30.00',
        },
      ),
    );
    expect(cart.coupon, isNotNull);
    expect(cart.coupon!.code, 'CUDDLE10');
    expect(cart.coupon!.discountMoney.minorUnits, 3000);
  });

  test('parses an empty cart', () {
    final cart = Cart.fromJson(const <String, dynamic>{
      'id': 'cart2',
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
    expect(cart.isEmpty, isTrue);
    expect(cart.coupon, isNull);
    expect(cart.summary.totalMoney.isZero, isTrue);
  });
}
