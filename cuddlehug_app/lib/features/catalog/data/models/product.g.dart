// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'product.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CategoryRef _$CategoryRefFromJson(Map<String, dynamic> json) => CategoryRef(
  id: json['id'] as String,
  name: json['name'] as String,
  slug: json['slug'] as String,
);

Map<String, dynamic> _$CategoryRefToJson(CategoryRef instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'slug': instance.slug,
    };

ProductImage _$ProductImageFromJson(Map<String, dynamic> json) => ProductImage(
  url: json['url'] as String,
  id: json['id'] as String?,
  alt: json['alt'] as String?,
  isPrimary: json['isPrimary'] as bool? ?? false,
);

Map<String, dynamic> _$ProductImageToJson(ProductImage instance) =>
    <String, dynamic>{
      'id': instance.id,
      'url': instance.url,
      'alt': instance.alt,
      'isPrimary': instance.isPrimary,
    };

ProductVariant _$ProductVariantFromJson(Map<String, dynamic> json) =>
    ProductVariant(
      id: json['id'] as String,
      size: json['size'] as String,
      color: json['color'] as String,
      sku: json['sku'] as String,
      price: json['price'] as String,
      mrp: json['mrp'] as String,
      available: (json['available'] as num?)?.toInt() ?? 0,
      lowStock: json['lowStock'] as bool? ?? false,
    );

Map<String, dynamic> _$ProductVariantToJson(ProductVariant instance) =>
    <String, dynamic>{
      'id': instance.id,
      'size': instance.size,
      'color': instance.color,
      'sku': instance.sku,
      'price': instance.price,
      'mrp': instance.mrp,
      'available': instance.available,
      'lowStock': instance.lowStock,
    };

ProductCard _$ProductCardFromJson(Map<String, dynamic> json) => ProductCard(
  id: json['id'] as String,
  name: json['name'] as String,
  slug: json['slug'] as String,
  sku: json['sku'] as String,
  mrp: json['mrp'] as String,
  price: json['price'] as String,
  discountPercent: (json['discountPercent'] as num).toInt(),
  status: json['status'] as String,
  category: CategoryRef.fromJson(json['category'] as Map<String, dynamic>),
  images: (json['images'] as List<dynamic>)
      .map((e) => ProductImage.fromJson(e as Map<String, dynamic>))
      .toList(),
  createdAt: DateTime.parse(json['createdAt'] as String),
  shortDescription: json['shortDescription'] as String?,
  image: json['image'] as String?,
  ratingAverage: (json['ratingAverage'] as num?)?.toDouble() ?? 0,
  ratingCount: (json['ratingCount'] as num?)?.toInt() ?? 0,
  reviewCount: (json['reviewCount'] as num?)?.toInt() ?? 0,
  soldCount: (json['soldCount'] as num?)?.toInt() ?? 0,
  isFeatured: json['isFeatured'] as bool? ?? false,
  isBestSeller: json['isBestSeller'] as bool? ?? false,
  isNewArrival: json['isNewArrival'] as bool? ?? false,
  inStock: json['inStock'] as bool? ?? true,
  available: (json['available'] as num?)?.toInt() ?? 0,
  lowStock: json['lowStock'] as bool? ?? false,
  variants:
      (json['variants'] as List<dynamic>?)
          ?.map((e) => ProductVariant.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const [],
);

Map<String, dynamic> _$ProductCardToJson(ProductCard instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'slug': instance.slug,
      'sku': instance.sku,
      'shortDescription': instance.shortDescription,
      'mrp': instance.mrp,
      'price': instance.price,
      'discountPercent': instance.discountPercent,
      'status': instance.status,
      'category': instance.category,
      'images': instance.images,
      'image': instance.image,
      'ratingAverage': instance.ratingAverage,
      'ratingCount': instance.ratingCount,
      'reviewCount': instance.reviewCount,
      'soldCount': instance.soldCount,
      'isFeatured': instance.isFeatured,
      'isBestSeller': instance.isBestSeller,
      'isNewArrival': instance.isNewArrival,
      'inStock': instance.inStock,
      'available': instance.available,
      'lowStock': instance.lowStock,
      'createdAt': instance.createdAt.toIso8601String(),
      'variants': instance.variants,
    };
