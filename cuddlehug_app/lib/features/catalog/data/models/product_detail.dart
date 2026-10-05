import 'package:cuddlehug_app/core/utils/money.dart';
import 'package:cuddlehug_app/features/catalog/data/models/product.dart';
import 'package:flutter/foundation.dart';
import 'package:json_annotation/json_annotation.dart';

part 'product_detail.g.dart';

/// Full product payload from `GET /api/products/:slug` — a superset of the
/// card shape (description, attributes, tags). Reviews arrive separately
/// from `GET /api/reviews/product/:id`.
@immutable
@JsonSerializable()
class ProductDetail {
  const new({
    required this.id,
    required this.name,
    required this.slug,
    required this.sku,
    required this.description,
    required this.mrp,
    required this.price,
    required this.discountPercent,
    required this.status,
    required this.category,
    required this.images,
    required this.createdAt,
    this.shortDescription,
    this.material,
    this.filling,
    this.weightGrams,
    this.careInstructions,
    this.ageRecommendation,
    this.tags = const [],
    this.isFeatured = false,
    this.isBestSeller = false,
    this.isNewArrival = false,
    this.soldCount = 0,
    this.lowStockThreshold = 5,
    this.ratingAverage = 0,
    this.ratingCount = 0,
    this.variants = const [],
  });

  factory fromJson(Map<String, dynamic> json) => _$ProductDetailFromJson(json);

  final String id;
  final String name;
  final String slug;
  final String sku;
  final String? shortDescription;
  final String description;
  final String mrp;
  final String price;
  final int discountPercent;
  final String status;
  final String? material;
  final String? filling;
  final int? weightGrams;
  final String? careInstructions;
  final String? ageRecommendation;
  final List<String> tags;
  final bool isFeatured;
  final bool isBestSeller;
  final bool isNewArrival;
  final int soldCount;
  final int lowStockThreshold;
  final double ratingAverage;
  final int ratingCount;
  final CategoryRef category;
  final List<ProductImage> images;
  final List<ProductVariant> variants;
  final DateTime createdAt;

  Money get priceMoney => Money.parse(price);
  Money get mrpMoney => Money.parse(mrp);
  bool get hasDiscount => discountPercent > 0;
  bool get inStock => variants.any((variant) => variant.isAvailable);
}
