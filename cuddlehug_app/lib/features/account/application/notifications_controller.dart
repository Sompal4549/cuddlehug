import 'dart:async';

import 'package:cuddlehug_app/core/network/paged.dart';
import 'package:cuddlehug_app/features/account/data/models/app_notification.dart';
import 'package:cuddlehug_app/features/account/data/notification_repository.dart';
import 'package:cuddlehug_app/features/auth/application/auth_controller.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

@immutable
class NotificationsState {
  const new({
    this.items = const <AppNotification>[],
    this.meta = PaginationMeta.first,
    this.unread = 0,
    this.loading = false,
    this.loadingMore = false,
    this.error,
  });

  final List<AppNotification> items;
  final PaginationMeta meta;
  final int unread;
  final bool loading;
  final bool loadingMore;
  final Object? error;

  bool get hasMore => meta.hasNext;
}

class NotificationsController extends Notifier<NotificationsState> {
  NotificationRepository get _repository =>
      ref.read(notificationRepositoryProvider);

  @override
  NotificationsState build() {
    final isAuthenticated = ref.watch(
      authControllerProvider.select((s) => s.isAuthenticated),
    );
    if (!isAuthenticated) return const NotificationsState();
    scheduleMicrotask(load);
    return const NotificationsState(loading: true);
  }

  Future<void> load() async {
    state = const NotificationsState(loading: true);
    try {
      final page = await _repository.list();
      state = NotificationsState(
        items: page.items,
        meta: page.meta,
        unread: page.unread,
      );
    } on Exception catch (e) {
      state = NotificationsState(error: e);
    }
  }

  Future<void> loadMore() async {
    final current = state;
    if (current.loading || current.loadingMore || !current.hasMore) return;
    state = NotificationsState(
      items: current.items,
      meta: current.meta,
      unread: current.unread,
      loadingMore: true,
      error: current.error,
    );
    try {
      final page = await _repository.list(page: current.meta.page + 1);
      state = NotificationsState(
        items: <AppNotification>[...current.items, ...page.items],
        meta: page.meta,
        unread: page.unread,
      );
    } on Exception catch (e) {
      state = NotificationsState(
        items: current.items,
        meta: current.meta,
        unread: current.unread,
        error: e,
      );
    }
  }

  /// Optimistically flips the row to read; reverts on a failed round-trip.
  Future<void> markRead(String id) async {
    final current = state;
    final index = current.items.indexWhere((n) => n.id == id);
    if (index == -1 || current.items[index].read) return;
    state = _replace(
      current,
      current.items
          .map((n) => n.id == id ? _copyRead(n, read: true) : n)
          .toList(),
      unread: current.unread > 0 ? current.unread - 1 : 0,
    );
    try {
      await _repository.markRead(id);
    } on Exception {
      state = _replace(
        state,
        state.items
            .map((n) => n.id == id ? _copyRead(n, read: false) : n)
            .toList(),
        unread: state.unread + 1,
      );
      rethrow;
    }
  }

  Future<void> markAllRead() async {
    final current = state;
    if (current.unread == 0) return;
    state = _replace(
      current,
      current.items.map((n) => _copyRead(n, read: true)).toList(),
      unread: 0,
    );
    try {
      await _repository.readAll();
    } on Exception {
      state = current;
      rethrow;
    }
  }

  /// Refreshes only the badge count (push foreground handler + 60s poll) —
  /// leaves the loaded list untouched.
  Future<void> syncUnread() async {
    try {
      final count = await _repository.unreadCount();
      final current = state;
      if (count == current.unread) return;
      state = NotificationsState(
        items: current.items,
        meta: current.meta,
        unread: count,
        loading: current.loading,
        loadingMore: current.loadingMore,
        error: current.error,
      );
    } on Exception {
      // Badge sync is best-effort — never surfaces an error.
    }
  }

  AppNotification _copyRead(AppNotification n, {required bool read}) =>
      AppNotification(
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        data: n.data,
        read: read,
        createdAt: n.createdAt,
      );

  NotificationsState _replace(
    NotificationsState current,
    List<AppNotification> items, {
    required int unread,
  }) => NotificationsState(
    items: items,
    meta: current.meta,
    unread: unread,
    loading: current.loading,
    loadingMore: current.loadingMore,
    error: current.error,
  );
}

/// Auth-gated notification inbox with the global unread badge count.
final notificationsProvider =
    NotifierProvider<NotificationsController, NotificationsState>(
      NotificationsController.new,
    );
