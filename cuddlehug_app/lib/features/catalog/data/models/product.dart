import 'package:cuddlehug_app/core/utils/money.dart';
import 'package:flutter/foundation.dart';
import 'package:json_annotation/json_annotation.dart';

part 'product.g.dart';

/// Category reference embedded in product payloads.
@immutable
@JsonSerializable()
class CategoryRef {
  const new({required this.id, required this.name, required this.slug});

  factory fromJson(Map<String, dynamic> json) => _$CategoryRefFromJson(json);

  final String id;
  final String name;
  final String slug;
}

/// A product image. List payloads omit `id`; detail payloads include it.
@immutable
@JsonSerializable()
class ProductImage {
  const new({required this.url, this.id, this.alt, this.isPrimary = false});

  factory fromJson(Map<String, dynamic> json) => _$ProductImageFromJson(json);

  final String? id;
  final String url;
  final String? alt;
  final bool isPrimary;
}

/// An active variant (size/color SKU). Money fields are backend decimal
/// strings like `"1499.00"` — parse via [Money.parse].
@immutable
@JsonSerializable()
class ProductVariant {
  const new({
    required this.id,
    required this.size,
    required this.color,
    required this.sku,
    required this.price,
    required this.mrp,
    this.available = 0,
    this.lowStock = false,
  });

  factory fromJson(Map<String, dynamic> json) => _$ProductVariantFromJson(json);

  final String id;
  final String size;
  final String color;
  final String sku;
  final String price;
  final String mrp;
  final int available;
  final bool lowStock;

  Money get priceMoney => Money.parse(price);
  Money get mrpMoney => Money.parse(mrp);

  bool get isAvailable => available > 0;
}

/// Compact product shape used by lists, grids and carousels
/// (backend `toProductCard`).
@immutable
@JsonSerializable()
class ProductCard {
  const new({
    required this.id,
    required this.name,
    required this.slug,
    required this.sku,
    required this.mrp,
    required this.price,
    required this.discountPercent,
    required this.status,
    required this.category,
    required this.images,
    required this.createdAt,
    this.shortDescription,
    this.image,
    this.ratingAverage = 0,
    this.ratingCount = 0,
    this.reviewCount = 0,
    this.soldCount = 0,
    this.isFeatured = false,
    this.isBestSeller = false,
    this.isNewArrival = false,
    this.inStock = true,
    this.available = 0,
    this.lowStock = false,
    this.variants = const [],
  });

  factory fromJson(Map<String, dynamic> json) => _$ProductCardFromJson(json);

  final String id;
  final String name;
  final String slug;
  final String sku;
  final String? shortDescription;
  final String mrp;
  final String price;
  final int discountPercent;
  final String status;
  final CategoryRef category;
  final List<ProductImage> images;
  final String? image;
  final double ratingAverage;
  final int ratingCount;
  final int reviewCount;
  final int soldCount;
  final bool isFeatured;
  final bool isBestSeller;
  final bool isNewArrival;
  final bool inStock;
  final int available;
  final bool lowStock;
  final DateTime createdAt;
  final List<ProductVariant> variants;

  Money get priceMoney => Money.parse(price);
  Money get mrpMoney => Money.parse(mrp);
  bool get hasDiscount => discountPercent > 0;
}
