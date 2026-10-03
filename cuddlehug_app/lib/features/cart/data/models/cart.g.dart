// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'cart.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CartProduct _$CartProductFromJson(Map<String, dynamic> json) => CartProduct(
  id: json['id'] as String,
  name: json['name'] as String,
  slug: json['slug'] as String,
  image: json['image'] as String?,
  status: json['status'] as String? ?? 'ACTIVE',
);

Map<String, dynamic> _$CartProductToJson(CartProduct instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'slug': instance.slug,
      'image': instance.image,
      'status': instance.status,
    };

CartVariant _$CartVariantFromJson(Map<String, dynamic> json) => CartVariant(
  id: json['id'] as String,
  size: json['size'] as String,
  color: json['color'] as String,
  sku: json['sku'] as String,
  price: json['price'] as String,
  mrp: json['mrp'] as String,
);

Map<String, dynamic> _$CartVariantToJson(CartVariant instance) =>
    <String, dynamic>{
      'id': instance.id,
      'size': instance.size,
      'color': instance.color,
      'sku': instance.sku,
      'price': instance.price,
      'mrp': instance.mrp,
    };

CartItem _$CartItemFromJson(Map<String, dynamic> json) => CartItem(
  id: json['id'] as String,
  variantId: json['variantId'] as String,
  quantity: (json['quantity'] as num).toInt(),
  maxQuantity: (json['maxQuantity'] as num).toInt(),
  inStock: json['inStock'] as bool,
  available: (json['available'] as num).toInt(),
  product: CartProduct.fromJson(json['product'] as Map<String, dynamic>),
  variant: CartVariant.fromJson(json['variant'] as Map<String, dynamic>),
);

Map<String, dynamic> _$CartItemToJson(CartItem instance) => <String, dynamic>{
  'id': instance.id,
  'variantId': instance.variantId,
  'quantity': instance.quantity,
  'maxQuantity': instance.maxQuantity,
  'inStock': instance.inStock,
  'available': instance.available,
  'product': instance.product,
  'variant': instance.variant,
};

AppliedCoupon _$AppliedCouponFromJson(Map<String, dynamic> json) =>
    AppliedCoupon(
      code: json['code'] as String,
      type: json['type'] as String,
      value: json['value'] as String,
      discount: json['discount'] as String,
      description: json['description'] as String?,
    );

Map<String, dynamic> _$AppliedCouponToJson(AppliedCoupon instance) =>
    <String, dynamic>{
      'code': instance.code,
      'description': instance.description,
      'type': instance.type,
      'value': instance.value,
      'discount': instance.discount,
    };

PriceLine _$PriceLineFromJson(Map<String, dynamic> json) => PriceLine(
  variantId: json['variantId'] as String,
  quantity: (json['quantity'] as num).toInt(),
  unitPrice: json['unitPrice'] as String,
  mrp: json['mrp'] as String,
  lineTotal: json['lineTotal'] as String,
  lineMrpTotal: json['lineMrpTotal'] as String,
  savings: json['savings'] as String,
);

Map<String, dynamic> _$PriceLineToJson(PriceLine instance) => <String, dynamic>{
  'variantId': instance.variantId,
  'quantity': instance.quantity,
  'unitPrice': instance.unitPrice,
  'mrp': instance.mrp,
  'lineTotal': instance.lineTotal,
  'lineMrpTotal': instance.lineMrpTotal,
  'savings': instance.savings,
};

CartSummary _$CartSummaryFromJson(Map<String, dynamic> json) => CartSummary(
  subtotal: json['subtotal'] as String,
  mrpTotal: json['mrpTotal'] as String,
  productSavings: json['productSavings'] as String,
  couponDiscount: json['couponDiscount'] as String,
  discountedSubtotal: json['discountedSubtotal'] as String,
  shipping: json['shipping'] as String,
  tax: json['tax'] as String,
  total: json['total'] as String,
  freeShippingUnlocked: json['freeShippingUnlocked'] as bool? ?? false,
  lines:
      (json['lines'] as List<dynamic>?)
          ?.map((e) => PriceLine.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const [],
);

Map<String, dynamic> _$CartSummaryToJson(CartSummary instance) =>
    <String, dynamic>{
      'subtotal': instance.subtotal,
      'mrpTotal': instance.mrpTotal,
      'productSavings': instance.productSavings,
      'couponDiscount': instance.couponDiscount,
      'discountedSubtotal': instance.discountedSubtotal,
      'shipping': instance.shipping,
      'tax': instance.tax,
      'total': instance.total,
      'freeShippingUnlocked': instance.freeShippingUnlocked,
      'lines': instance.lines,
    };

Cart _$CartFromJson(Map<String, dynamic> json) => Cart(
  id: json['id'] as String,
  itemCount: (json['itemCount'] as num).toInt(),
  summary: CartSummary.fromJson(json['summary'] as Map<String, dynamic>),
  items:
      (json['items'] as List<dynamic>?)
          ?.map((e) => CartItem.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const [],
  coupon: json['coupon'] == null
      ? null
      : AppliedCoupon.fromJson(json['coupon'] as Map<String, dynamic>),
);

Map<String, dynamic> _$CartToJson(Cart instance) => <String, dynamic>{
  'id': instance.id,
  'itemCount': instance.itemCount,
  'items': instance.items,
  'coupon': instance.coupon,
  'summary': instance.summary,
};
