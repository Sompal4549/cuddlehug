import 'package:flutter/foundation.dart';
import 'package:json_annotation/json_annotation.dart';

part 'category.g.dart';

/// A shop category. List payloads carry `sortOrder`/`childCount`;
/// the `:slug` detail payload omits them (nullable). Named `ShopCategory`
/// to avoid clashing with `package:flutter/foundation.dart`'s `Category`
/// annotation.
@immutable
@JsonSerializable()
class ShopCategory {
  const new({
    required this.id,
    required this.name,
    required this.slug,
    required this.productCount,
    this.description,
    this.image,
    this.sortOrder,
    this.childCount,
  });

  factory fromJson(Map<String, dynamic> json) => _$ShopCategoryFromJson(json);

  final String id;
  final String name;
  final String slug;
  final String? description;
  final String? image;
  final int? sortOrder;
  final int productCount;
  final int? childCount;
}
