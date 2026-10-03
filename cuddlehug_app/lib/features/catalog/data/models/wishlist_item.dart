import 'package:cuddlehug_app/core/utils/money.dart';
import 'package:flutter/foundation.dart';
import 'package:json_annotation/json_annotation.dart';

part 'wishlist_item.g.dart';

/// The wishlist product summary embedded in `GET /api/wishlist` items.
@immutable
@JsonSerializable()
class WishlistProduct {
  const new({
    required this.id,
    required this.name,
    required this.slug,
    required this.price, required this.mrp, required this.discountPercent, this.image,
    this.ratingAverage = 0,
    this.ratingCount = 0,
    this.inStock = true,
    this.variantId,
  });

  factory fromJson(Map<String, dynamic> json) =>
      _$WishlistProductFromJson(json);

  final String id;
  final String name;
  final String slug;
  final String? image;
  final String price;
  final String mrp;
  final int discountPercent;
  final double ratingAverage;
  final int ratingCount;
  final bool inStock;
  final String? variantId;

  Money get priceMoney => Money.parse(price);
  Money get mrpMoney => Money.parse(mrp);
}

/// A wishlist row (`{id, createdAt, product}`), newest first.
@immutable
@JsonSerializable()
class WishlistItem {
  const new({required this.id, required this.createdAt, required this.product});

  factory fromJson(Map<String, dynamic> json) =>
      _$WishlistItemFromJson(json);

  final String id;
  final DateTime createdAt;
  final WishlistProduct product;
}
