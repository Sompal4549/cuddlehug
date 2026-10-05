import 'package:flutter/foundation.dart';

/// Pagination metadata returned by the backend's paged endpoints
/// (`{page,limit,total,totalPages}` alongside `data`).
@immutable
class PaginationMeta {
  const new({
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  factory fromJson(Map<String, dynamic> json) => PaginationMeta(
    page: (json['page'] as num?)?.toInt() ?? 1,
    limit: (json['limit'] as num?)?.toInt() ?? 12,
    total: (json['total'] as num?)?.toInt() ?? 0,
    totalPages: (json['totalPages'] as num?)?.toInt() ?? 1,
  );

  static const first = PaginationMeta(
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1,
  );

  final int page;
  final int limit;
  final int total;
  final int totalPages;

  bool get hasNext => page < totalPages;
  bool get isEmpty => total == 0;

  PaginationMeta nextPage() => PaginationMeta(
    page: page + 1,
    limit: limit,
    total: total,
    totalPages: totalPages,
  );
}

/// A page of items plus its pagination metadata.
@immutable
class Paged<T> {
  const new({required this.items, required this.meta});

  final List<T> items;
  final PaginationMeta meta;
}
