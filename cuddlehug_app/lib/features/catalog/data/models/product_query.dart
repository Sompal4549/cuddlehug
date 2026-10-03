import 'package:flutter/foundation.dart';

/// Backend sort options (`listQuerySchema.sort`).
enum ProductSort {
  relevance('relevance', 'Relevance'),
  priceAsc('price_asc', 'Price: low to high'),
  priceDesc('price_desc', 'Price: high to low'),
  newest('newest', 'Newest first'),
  rating('rating', 'Customer rating'),
  bestselling('bestselling', 'Best selling'),
  discount('discount', 'Biggest discount');

  new(this.queryValue, this.label);

  final String queryValue;
  final String label;
}

/// Immutable filter/sort/pagination state for `GET /api/products`.
/// Matches the backend zod query schema — unknown keys are stripped
/// server-side, nulls/empties are stripped client-side by DioClient.
@immutable
class ProductQuery {
  const new({
    this.search,
    this.category,
    this.minPrice,
    this.maxPrice,
    this.sizes = const {},
    this.colors = const {},
    this.rating,
    this.availability = 'all',
    this.sort = ProductSort.relevance,
    this.page = 1,
    this.limit = 12,
  });

  final String? search;
  final String? category;
  final num? minPrice;
  final num? maxPrice;

  /// Variant size enum values: `MINI|SMALL|MEDIUM|LARGE|GIANT`.
  final Set<String> sizes;

  /// Variant color enum values: `BROWN|PINK|WHITE|CREAM|RED`.
  final Set<String> colors;

  /// Minimum customer rating (0–5), null = any.
  final double? rating;

  /// `all` | `in_stock` | `out_of_stock`.
  final String availability;

  final ProductSort sort;
  final int page;
  final int limit;

  bool get hasFilters =>
      category != null ||
      search != null ||
      minPrice != null ||
      maxPrice != null ||
      sizes.isNotEmpty ||
      colors.isNotEmpty ||
      rating != null ||
      availability != 'all';

  int get activeFilterCount =>
      (category != null ? 1 : 0) +
      (minPrice != null || maxPrice != null ? 1 : 0) +
      (sizes.isNotEmpty ? 1 : 0) +
      (colors.isNotEmpty ? 1 : 0) +
      (rating != null ? 1 : 0) +
      (availability != 'all' ? 1 : 0);

  /// Same filters with a different page — page 1 for a fresh load.
  ProductQuery atPage(int page) => ProductQuery(
        search: search,
        category: category,
        minPrice: minPrice,
        maxPrice: maxPrice,
        sizes: sizes,
        colors: colors,
        rating: rating,
        availability: availability,
        sort: sort,
        page: page,
        limit: limit,
      );

  /// Query params for the backend — DioClient drops nulls/empties.
  Map<String, dynamic> toMap() => {
        if (search != null && search!.trim().isNotEmpty)
          'search': search!.trim(),
        if (category != null) 'category': category,
        if (minPrice != null) 'minPrice': minPrice,
        if (maxPrice != null) 'maxPrice': maxPrice,
        if (sizes.isNotEmpty) 'size': sizes.join(','),
        if (colors.isNotEmpty) 'color': colors.join(','),
        if (rating != null) 'rating': rating,
        if (availability != 'all') 'availability': availability,
        'sort': sort.queryValue,
        'page': page,
        'limit': limit,
      };

  @override
  bool operator ==(Object other) =>
      other is ProductQuery &&
      other.search == search &&
      other.category == category &&
      other.minPrice == minPrice &&
      other.maxPrice == maxPrice &&
      other.availability == availability &&
      other.rating == rating &&
      other.sort == sort &&
      other.page == page &&
      other.limit == limit &&
      other.sizes.length == sizes.length &&
      other.sizes.containsAll(sizes) &&
      other.colors.length == colors.length &&
      other.colors.containsAll(colors);

  @override
  int get hashCode => Object.hash(
        search,
        category,
        minPrice,
        maxPrice,
        availability,
        rating,
        sort,
        page,
        limit,
        Object.hashAllUnordered(sizes),
        Object.hashAllUnordered(colors),
      );
}
