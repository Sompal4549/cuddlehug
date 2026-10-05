import 'dart:async';

import 'package:cuddlehug_app/core/network/paged.dart';
import 'package:cuddlehug_app/features/auth/application/auth_controller.dart';
import 'package:cuddlehug_app/features/orders/data/models/order.dart';
import 'package:cuddlehug_app/features/orders/data/order_repository.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';

/// Paginated order history for the orders screen.
@immutable
class OrdersState {
  const new({
    this.items = const [],
    this.meta = PaginationMeta.first,
    this.loading = false,
    this.loadingMore = false,
    this.error,
  });

  final List<Order> items;
  final PaginationMeta meta;
  final bool loading;
  final bool loadingMore;
  final Object? error;

  bool get isEmpty => !loading && error == null && items.isEmpty;
  bool get hasMore => meta.hasNext;

  OrdersState copyWith({
    List<Order>? items,
    PaginationMeta? meta,
    bool? loading,
    bool? loadingMore,
    Object? error,
    bool clearError = false,
  }) => OrdersState(
    items: items ?? this.items,
    meta: meta ?? this.meta,
    loading: loading ?? this.loading,
    loadingMore: loadingMore ?? this.loadingMore,
    error: clearError ? null : error ?? this.error,
  );
}

class OrdersController extends Notifier<OrdersState> {
  @override
  OrdersState build() {
    final authenticated = ref.watch(
      authControllerProvider.select((auth) => auth.isAuthenticated),
    );
    if (authenticated) {
      scheduleMicrotask(load);
      return const OrdersState(loading: true);
    }
    return const OrdersState();
  }

  Future<void> load() async {
    state = state.copyWith(loading: true, clearError: true);
    try {
      final paged = await _repo.list();
      state = OrdersState(items: paged.items, meta: paged.meta);
    } on Object catch (error) {
      state = state.copyWith(loading: false, error: error);
    }
  }

  Future<void> loadMore() async {
    final current = state;
    if (current.loading || current.loadingMore || !current.hasMore) return;
    state = current.copyWith(loadingMore: true, clearError: true);
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

  OrderRepository get _repo => ref.read(orderRepositoryProvider);
}

final ordersProvider = NotifierProvider<OrdersController, OrdersState>(
  OrdersController.new,
);

/// Single order detail (family keyed by order id).
final FutureProviderFamily<Order, String> orderDetailProvider =
    FutureProvider.family<Order, String>(
      (ref, id) => ref.watch(orderRepositoryProvider).getById(id),
    );

/// Account order stats (`GET /api/orders/stats`).
final FutureProvider<OrderStats> orderStatsProvider =
    FutureProvider<OrderStats>(
      (ref) => ref.watch(orderRepositoryProvider).stats(),
    );
