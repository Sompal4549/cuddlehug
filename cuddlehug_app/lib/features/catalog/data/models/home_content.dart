import 'package:cuddlehug_app/features/catalog/data/models/category.dart';
import 'package:cuddlehug_app/features/catalog/data/models/product.dart';
import 'package:flutter/foundation.dart';
import 'package:json_annotation/json_annotation.dart';

part 'home_content.g.dart';

/// One slide of the home hero carousel.
@immutable
@JsonSerializable()
class HeroSlide {
  const new({required this.image, required this.alt});

  factory fromJson(Map<String, dynamic> json) => _$HeroSlideFromJson(json);

  final String image;
  final String alt;
}

/// Single-round-trip payload from `GET /api/content/home`.
@immutable
@JsonSerializable()
class HomeContent {
  const new({
    required this.settings,
    required this.categories,
    required this.featured,
    required this.bestSellers,
    required this.newArrivals,
    this.hero = const [],
  });

  factory fromJson(Map<String, dynamic> json) => _$HomeContentFromJson(json);

  /// Flat store settings with dotted keys (`store.name`, `shipping.fee`…).
  final Map<String, dynamic> settings;
  final List<ShopCategory> categories;
  final List<ProductCard> featured;
  final List<ProductCard> bestSellers;
  final List<ProductCard> newArrivals;
  final List<HeroSlide> hero;

  String get storeName => settings['store.name'] as String? ?? 'CuddleHug';
  String get tagline =>
      settings['store.tagline'] as String? ?? 'More Happiness. More Hugs.';
}
