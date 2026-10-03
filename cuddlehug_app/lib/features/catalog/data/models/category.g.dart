// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'category.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ShopCategory _$ShopCategoryFromJson(Map<String, dynamic> json) => ShopCategory(
  id: json['id'] as String,
  name: json['name'] as String,
  slug: json['slug'] as String,
  productCount: (json['productCount'] as num).toInt(),
  description: json['description'] as String?,
  image: json['image'] as String?,
  sortOrder: (json['sortOrder'] as num?)?.toInt(),
  childCount: (json['childCount'] as num?)?.toInt(),
);

Map<String, dynamic> _$ShopCategoryToJson(ShopCategory instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'slug': instance.slug,
      'description': instance.description,
      'image': instance.image,
      'sortOrder': instance.sortOrder,
      'productCount': instance.productCount,
      'childCount': instance.childCount,
    };
