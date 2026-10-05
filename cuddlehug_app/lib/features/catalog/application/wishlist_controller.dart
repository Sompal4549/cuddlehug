import 'dart:async';

import 'package:cuddlehug_app/core/network/paged.dart';
import 'package:cuddlehug_app/features/auth/application/auth_controller.dart';
import 'package:cuddlehug_app/features/catalog/data/models/wishlist_item.dart';
import 'package:cuddlehug_app/features/catalog/data/wishlist_repository.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Wishlist state: paginated rows for the wishlist screen plus a
/// `productIds` set powering heart icons across product surfaces.
/// Loads the first 100 items (backend max) so ids cover typical lists.
@immutable
class WishlistState {
  const new({
    this.items = const [],
    this.meta = PaginationMeta.first,
    this.productIds = const {},
    this.loading = false,
    this.loadingMore = false,
    this.busyIds = const {},
    this.error,
  });

  final List<WishlistItem> items;
  final PaginationMeta meta;
  final Set<String> productIds;
  final bool loading;
  final bool loadingMore;
  final Set<String> busyIds;
  final Object? error;

  bool get isEmpty => !loading && error == null && items.isEmpty;
  bool get hasMore => meta.hasNext;
  bool contains(String productId) => productIds.contains(productId);

  WishlistState copyWith({
    List<WishlistItem>? items,
    PaginationMeta? meta,
    Set<String>? productIds,
    bool? loading,
    bool? loadingMore,
    Set<String>? busyIds,
    Object? error,
    bool clearError = false,
  }) => WishlistState(
    items: items ?? this.items,
    meta: meta ?? this.meta,
    productIds: productIds ?? this.productIds,
    loading: loading ?? this.loading,
    loadingMore: loadingMore ?? this.loadingMore,
    busyIds: busyIds ?? this.busyIds,
    error: clearError ? null : error ?? this.error,
  );
}

/// Loads on sign-in (rebuilt via [authControllerProvider] watch) and clears
/// on sign-out. [toggle] is optimistic — a failed call reverts and rethrows.
class WishlistController extends Notifier<WishlistState> {
  @override
  WishlistState build() {
    final authenticated = ref.watch(
      authControllerProvider.select((auth) => auth.isAuthenticated),
    );
    if (authenticated) {
      unawaited(_load());
      return const WishlistState(loading: true);
    }
    return const WishlistState();
  }

  Future<void> _load() async {
    try {
      final paged = await _repo.list(limit: 100);
      state = WishlistState(
        items: paged.items,
        meta: paged.meta,
        productIds: {for (final item in paged.items) item.product.id},
      );
    } on Object catch (error) {
      state = WishlistState(error: error);
    }
  }

  Future<void> loadMore() async {
    final current = state;
    if (current.loading || current.loadingMore || !current.hasMore) return;
    state = current.copyWith(loadingMore: true);
    try {
      final paged = await _repo.list(page: current.meta.page + 1);
      state = current.copyWith(
        items: [...current.items, ...paged.items],
        meta: paged.meta,
        loadingMore: false,
      );
    } on Object catch (error) {
      state = current.copyWith(loadingMore: false, error: error);
    }
  }

  Future<void> refresh() async {
    state = state.copyWith(loading: true);
    await _load();
  }

  /// Returns `true` when the product is now wishlisted.
  Future<bool> toggle(String productId) async {
    final wasWishlisted = state.productIds.contains(productId);
    final originalIds = state.productIds;
    final ids = {...state.productIds};
    if (wasWishlisted) {
      ids.remove(productId);
    } else {
      ids.add(productId);
    }
    state = state.copyWith(
      productIds: ids,
      busyIds: {...state.busyIds, productId},
    );
    try {
      if (wasWishlisted) {
        await _repo.remove(productId);
      } else {
        await _repo.add(productId);
      }
      state = state.copyWith(busyIds: {...state.busyIds}..remove(productId));
      return !wasWishlisted;
    } on Object {
      state = state.copyWith(
        productIds: {...originalIds},
        busyIds: {...state.busyIds}..remove(productId),
      );
      rethrow;
    }
  }

  WishlistRepository get _repo => ref.read(wishlistRepositoryProvider);
}

final wishlistProvider = NotifierProvider<WishlistController, WishlistState>(
  WishlistController.new,
);
