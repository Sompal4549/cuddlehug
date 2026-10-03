import 'package:cuddlehug_app/core/network/paged.dart';
import 'package:cuddlehug_app/features/catalog/data/catalog_repository.dart';
import 'package:cuddlehug_app/features/catalog/data/models/product.dart';
import 'package:cuddlehug_app/features/catalog/data/models/product_query.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';

/// Pagination/filter state for one product list surface.
@immutable
class ProductListState {
  const new({
    this.query = const ProductQuery(),
    this.items = const [],
    this.meta = PaginationMeta.first,
    this.loading = false,
    this.loadingMore = false,
    this.error,
  });

  final ProductQuery query;
  final List<ProductCard> items;
  final PaginationMeta meta;
  final bool loading;
  final bool loadingMore;
  final Object? error;

  bool get hasMore => meta.hasNext;
  bool get isEmpty => !loading && error == null && items.isEmpty;
  bool get initialLoading => loading && items.isEmpty;

  ProductListState copyWith({
    ProductQuery? query,
    List<ProductCard>? items,
    PaginationMeta? meta,
    bool? loading,
    bool? loadingMore,
    Object? error,
    bool clearError = false,
  }) =>
      ProductListState(
        query: query ?? this.query,
        items: items ?? this.items,
        meta: meta ?? this.meta,
        loading: loading ?? this.loading,
        loadingMore: loadingMore ?? this.loadingMore,
        error: clearError ? null : error ?? this.error,
      );
}

/// Family of product list loaders — one instance per screen scope
/// (`shop`, `category:<slug>`, `search`) so screens never clobber each
/// other's results.
class ProductListController extends Notifier<ProductListState> {
  new(this._scope);

  final String _scope;
  int _seq = 0;

  /// Exposed for tests/diagnostics only.
  String get scope => _scope;

  @override
  ProductListState build() => const ProductListState();

  /// Loads page 1 for [query]. Skips the fetch when the query is already
  /// loaded unless [force] is set (pull-to-refresh).
  Future<void> applyQuery(ProductQuery query, {bool force = false}) async {
    final base = query.atPage(1);
    if (!force &&
        base == state.query &&
        state.items.isNotEmpty &&
        state.error == null) {
      return;
    }
    final seq = ++_seq;
    state = ProductListState(query: base, loading: true);
    try {
      final paged = await _repo.listProducts(base);
      if (seq != _seq) return;
      state = ProductListState(query: base, items: paged.items, meta: paged.meta);
    } on Object catch (error) {
      if (seq != _seq) return;
      state = ProductListState(query: base, error: error);
    }
  }

  /// Appends the next page; failures keep existing items and retry on the
  /// next scroll trigger.
  Future<void> loadMore() async {
    final current = state;
    if (current.loading || current.loadingMore || !current.hasMore) return;
    final seq = _seq;
    state = current.copyWith(loadingMore: true, clearError: true);
    try {
      final paged = await _repo.listProducts(
        current.query.atPage(current.meta.page + 1),
      );
      if (seq != _seq) return;
      state = current.copyWith(
        items: [...current.items, ...paged.items],
        meta: paged.meta,
        loadingMore: false,
        clearError: true,
      );
    } on Object {
      if (seq != _seq) return;
      state = current.copyWith(loadingMore: false, clearError: true);
    }
  }

  CatalogRepository get _repo => ref.read(catalogRepositoryProvider);
}

/// `productListProvider('shop')`, `('category:<slug>')`, `('search')`…
final NotifierProviderFamily<ProductListController, ProductListState, String> productListProvider =
    NotifierProvider.family<ProductListController, ProductListState, String>(
  ProductListController.new,
);
