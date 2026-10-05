import 'package:cuddlehug_app/core/utils/money.dart';
import 'package:flutter/foundation.dart';
import 'package:json_annotation/json_annotation.dart';

part 'cart.g.dart';

/// Product reference embedded in cart lines.
@immutable
@JsonSerializable()
class CartProduct {
  const new({
    required this.id,
    required this.name,
    required this.slug,
    this.image,
    this.status = 'ACTIVE',
  });

  factory fromJson(Map<String, dynamic> json) => _$CartProductFromJson(json);

  final String id;
  final String name;
  final String slug;
  final String? image;
  final String status;
}

/// Variant reference embedded in cart lines (money = decimal strings).
@immutable
@JsonSerializable()
class CartVariant {
  const new({
    required this.id,
    required this.size,
    required this.color,
    required this.sku,
    required this.price,
    required this.mrp,
  });

  factory fromJson(Map<String, dynamic> json) => _$CartVariantFromJson(json);

  final String id;
  final String size;
  final String color;
  final String sku;
  final String price;
  final String mrp;

  Money get priceMoney => Money.parse(price);
  Money get mrpMoney => Money.parse(mrp);
  String get label => '$size / $color';
}

/// One cart line. [quantity] is user-chosen (0 deletes server-side),
/// [maxQuantity] is the clamp (10 or stock).
@immutable
@JsonSerializable()
class CartItem {
  const new({
    required this.id,
    required this.variantId,
    required this.quantity,
    required this.maxQuantity,
    required this.inStock,
    required this.available,
    required this.product,
    required this.variant,
  });

  factory fromJson(Map<String, dynamic> json) => _$CartItemFromJson(json);

  final String id;
  final String variantId;
  final int quantity;
  final int maxQuantity;
  final bool inStock;
  final int available;
  final CartProduct product;
  final CartVariant variant;

  Money get lineTotal => variant.priceMoney * quantity;
}

/// Applied coupon on the cart.
@immutable
@JsonSerializable()
class AppliedCoupon {
  const new({
    required this.code,
    required this.type,
    required this.value,
    required this.discount,
    this.description,
  });

  factory fromJson(Map<String, dynamic> json) => _$AppliedCouponFromJson(json);

  final String code;
  final String? description;
  final String type;
  final String value;
  final String discount;

  Money get discountMoney => Money.parse(discount);
}

/// One row of the server-computed pricing breakdown.
@immutable
@JsonSerializable()
class PriceLine {
  const new({
    required this.variantId,
    required this.quantity,
    required this.unitPrice,
    required this.mrp,
    required this.lineTotal,
    required this.lineMrpTotal,
    required this.savings,
  });

  factory fromJson(Map<String, dynamic> json) => _$PriceLineFromJson(json);

  final String variantId;
  final int quantity;
  final String unitPrice;
  final String mrp;
  final String lineTotal;
  final String lineMrpTotal;
  final String savings;
}

/// Server-computed cart totals (plan §4.3 — the backend is the single
/// source of truth for pricing).
@immutable
@JsonSerializable()
class CartSummary {
  const new({
    required this.subtotal,
    required this.mrpTotal,
    required this.productSavings,
    required this.couponDiscount,
    required this.discountedSubtotal,
    required this.shipping,
    required this.tax,
    required this.total,
    this.freeShippingUnlocked = false,
    this.lines = const [],
  });

  factory fromJson(Map<String, dynamic> json) => _$CartSummaryFromJson(json);

  final String subtotal;
  final String mrpTotal;
  final String productSavings;
  final String couponDiscount;
  final String discountedSubtotal;
  final String shipping;
  final String tax;
  final String total;
  final bool freeShippingUnlocked;
  final List<PriceLine> lines;

  Money get subtotalMoney => Money.parse(subtotal);
  Money get savingsMoney => Money.parse(productSavings);
  Money get couponMoney => Money.parse(couponDiscount);
  Money get shippingMoney => Money.parse(shipping);
  Money get taxMoney => Money.parse(tax);
  Money get totalMoney => Money.parse(total);
}

/// Full cart DTO from every `/api/cart*` endpoint.
@immutable
@JsonSerializable()
class Cart {
  const new({
    required this.id,
    required this.itemCount,
    required this.summary,
    this.items = const [],
    this.coupon,
  });

  factory fromJson(Map<String, dynamic> json) => _$CartFromJson(json);

  final String id;
  final int itemCount;
  final List<CartItem> items;
  final AppliedCoupon? coupon;
  final CartSummary summary;

  bool get isEmpty => items.isEmpty;
}
