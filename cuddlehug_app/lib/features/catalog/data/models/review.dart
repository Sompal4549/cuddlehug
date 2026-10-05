import 'package:cuddlehug_app/core/network/paged.dart';
import 'package:flutter/foundation.dart';
import 'package:json_annotation/json_annotation.dart';

part 'review.g.dart';

/// Review author reference.
@immutable
@JsonSerializable()
class ReviewUser {
  const new({required this.id, required this.name, this.avatarUrl});

  factory fromJson(Map<String, dynamic> json) => _$ReviewUserFromJson(json);

  final String id;
  final String name;
  final String? avatarUrl;
}

/// An approved product review (`toReviewDto`).
@immutable
@JsonSerializable()
class Review {
  const new({
    required this.id,
    required this.rating,
    required this.comment,
    required this.status,
    required this.createdAt,
    required this.user,
    this.title,
    this.imageUrl,
  });

  factory fromJson(Map<String, dynamic> json) => _$ReviewFromJson(json);

  final String id;
  final int rating;
  final String? title;
  final String comment;
  final String? imageUrl;
  final String status;
  final DateTime createdAt;
  final ReviewUser user;
}

/// `GET /api/reviews/product/:id` payload: items + rating distribution
/// (keys "5"…"1") + pagination meta.
@immutable
class ReviewPage {
  const new({
    required this.items,
    required this.distribution,
    required this.meta,
  });

  factory fromJson(Map<String, dynamic> json) => ReviewPage(
    items: (json['items'] as List<dynamic>? ?? const [])
        .map((item) => Review.fromJson(item as Map<String, dynamic>))
        .toList(),
    distribution: {
      for (final entry
          in (json['distribution'] as Map<String, dynamic>? ?? const {})
              .entries)
        entry.key: (entry.value as num).toInt(),
    },
    meta: PaginationMeta.first,
  );

  final List<Review> items;
  final Map<String, int> distribution;
  final PaginationMeta meta;

  int get totalReviews =>
      distribution.values.fold<int>(0, (sum, count) => sum + count);
}
