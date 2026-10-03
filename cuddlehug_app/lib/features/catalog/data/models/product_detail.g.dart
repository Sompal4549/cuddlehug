// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'product_detail.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ProductDetail _$ProductDetailFromJson(Map<String, dynamic> json) =>
    ProductDetail(
      id: json['id'] as String,
      name: json['name'] as String,
      slug: json['slug'] as String,
      sku: json['sku'] as String,
      description: json['description'] as String,
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
      material: json['material'] as String?,
      filling: json['filling'] as String?,
      weightGrams: (json['weightGrams'] as num?)?.toInt(),
      careInstructions: json['careInstructions'] as String?,
      ageRecommendation: json['ageRecommendation'] as String?,
      tags:
          (json['tags'] as List<dynamic>?)?.map((e) => e as String).toList() ??
          const [],
      isFeatured: json['isFeatured'] as bool? ?? false,
      isBestSeller: json['isBestSeller'] as bool? ?? false,
      isNewArrival: json['isNewArrival'] as bool? ?? false,
      soldCount: (json['soldCount'] as num?)?.toInt() ?? 0,
      lowStockThreshold: (json['lowStockThreshold'] as num?)?.toInt() ?? 5,
      ratingAverage: (json['ratingAverage'] as num?)?.toDouble() ?? 0,
      ratingCount: (json['ratingCount'] as num?)?.toInt() ?? 0,
      variants:
          (json['variants'] as List<dynamic>?)
              ?.map((e) => ProductVariant.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
    );

Map<String, dynamic> _$ProductDetailToJson(ProductDetail instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'slug': instance.slug,
      'sku': instance.sku,
      'shortDescription': instance.shortDescription,
      'description': instance.description,
      'mrp': instance.mrp,
      'price': instance.price,
      'discountPercent': instance.discountPercent,
      'status': instance.status,
      'material': instance.material,
      'filling': instance.filling,
      'weightGrams': instance.weightGrams,
      'careInstructions': instance.careInstructions,
      'ageRecommendation': instance.ageRecommendation,
      'tags': instance.tags,
      'isFeatured': instance.isFeatured,
      'isBestSeller': instance.isBestSeller,
      'isNewArrival': instance.isNewArrival,
      'soldCount': instance.soldCount,
      'lowStockThreshold': instance.lowStockThreshold,
      'ratingAverage': instance.ratingAverage,
      'ratingCount': instance.ratingCount,
      'category': instance.category,
      'images': instance.images,
      'variants': instance.variants,
      'createdAt': instance.createdAt.toIso8601String(),
    };
