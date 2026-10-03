// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'wishlist_item.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

WishlistProduct _$WishlistProductFromJson(Map<String, dynamic> json) =>
    WishlistProduct(
      id: json['id'] as String,
      name: json['name'] as String,
      slug: json['slug'] as String,
      price: json['price'] as String,
      mrp: json['mrp'] as String,
      discountPercent: (json['discountPercent'] as num).toInt(),
      image: json['image'] as String?,
      ratingAverage: (json['ratingAverage'] as num?)?.toDouble() ?? 0,
      ratingCount: (json['ratingCount'] as num?)?.toInt() ?? 0,
      inStock: json['inStock'] as bool? ?? true,
      variantId: json['variantId'] as String?,
    );

Map<String, dynamic> _$WishlistProductToJson(WishlistProduct instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'slug': instance.slug,
      'image': instance.image,
      'price': instance.price,
      'mrp': instance.mrp,
      'discountPercent': instance.discountPercent,
      'ratingAverage': instance.ratingAverage,
      'ratingCount': instance.ratingCount,
      'inStock': instance.inStock,
      'variantId': instance.variantId,
    };

WishlistItem _$WishlistItemFromJson(Map<String, dynamic> json) => WishlistItem(
  id: json['id'] as String,
  createdAt: DateTime.parse(json['createdAt'] as String),
  product: WishlistProduct.fromJson(json['product'] as Map<String, dynamic>),
);

Map<String, dynamic> _$WishlistItemToJson(WishlistItem instance) =>
    <String, dynamic>{
      'id': instance.id,
      'createdAt': instance.createdAt.toIso8601String(),
      'product': instance.product,
    };
