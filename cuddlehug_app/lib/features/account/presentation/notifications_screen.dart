import 'dart:async';

import 'package:cuddlehug_app/core/routing/responsive.dart';
import 'package:cuddlehug_app/core/theme/colors.dart';
import 'package:cuddlehug_app/core/theme/spacing.dart';
import 'package:cuddlehug_app/core/utils/formatters.dart';
import 'package:cuddlehug_app/core/widgets/empty_state.dart';
import 'package:cuddlehug_app/core/widgets/error_view.dart';
import 'package:cuddlehug_app/core/widgets/skeleton_box.dart';
import 'package:cuddlehug_app/features/account/application/notifications_controller.dart';
import 'package:cuddlehug_app/features/account/data/models/app_notification.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Notification inbox (`/notifications`, protected). Tapping a row marks
/// it read; the AppBar action marks everything read. On expanded tablets
/// (plan §14.2) the screen becomes a 360dp master list + detail pane.
class NotificationsScreen extends ConsumerStatefulWidget {
  const new({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() =>
      _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  AppNotification? _selected;

  static IconData _iconFor(String type) => switch (type) {
    'ORDER_CONFIRMATION' => Icons.receipt_long_outlined,
    'PAYMENT_CONFIRMATION' => Icons.payment_outlined,
    'SHIPPING' => Icons.local_shipping_outlined,
    'DELIVERY' => Icons.inventory_2_outlined,
    'PASSWORD_RESET' => Icons.lock_outline,
    _ => Icons.notifications_none_rounded,
  };

  Future<void> _open(
    NotificationsController controller,
    AppNotification n,
  ) async {
    setState(() => _selected = n);
    if (!n.read) {
      try {
        await controller.markRead(n.id);
      } on Exception {
        // State listener shows the failure; the row reverts locally.
      }
    }
  }

  Widget _tile(
    NotificationsController controller,
    AppNotification item, {
    required bool selected,
  }) => InkWell(
    onTap: () => unawaited(_open(controller, item)),
    child: Container(
      color: selected
          ? AppColors.accent
          : item.read
          ? null
          : AppColors.cardMuted,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm + 2,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: item.read ? AppColors.muted : AppColors.accent,
            child: Icon(
              _iconFor(item.type),
              size: 18,
              color: item.read ? AppColors.mutedForeground : AppColors.onAccent,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        item.title,
                        style: TextStyle(
                          fontWeight: item.read
                              ? FontWeight.w500
                              : FontWeight.w700,
                        ),
                      ),
                    ),
                    if (!item.read)
                      Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                          color: AppColors.primary,
                          shape: BoxShape.circle,
                        ),
                      ),
                  ],
                ),
                if (item.body != null && item.body!.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    item.body!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppColors.mutedForeground,
                      fontSize: 13,
                    ),
                  ),
                ],
                const SizedBox(height: 4),
                Text(
                  formatDateTime(item.createdAt),
                  style: const TextStyle(
                    color: AppColors.mutedForeground,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );

  Widget _list(NotificationsState state, NotificationsController controller) =>
      NotificationListener<ScrollNotification>(
        onNotification: (notification) {
          final metrics = notification.metrics;
          if (metrics.pixels >= metrics.maxScrollExtent - 400 &&
              !state.loadingMore) {
            unawaited(controller.loadMore());
          }
          return false;
        },
        child: ListView.separated(
          itemCount: state.items.length + (state.hasMore ? 1 : 0),
          separatorBuilder: (_, _) => const Divider(height: 1),
          itemBuilder: (context, index) {
            if (index >= state.items.length) {
              return const Padding(
                padding: EdgeInsets.all(AppSpacing.md),
                child: Center(
                  child: SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2.5),
                  ),
                ),
              );
            }
            final item = state.items[index];
            return _tile(controller, item, selected: _selected?.id == item.id);
          },
        ),
      );

  Widget _detail() {
    final item = _selected;
    if (item == null) {
      return const EmptyState(
        icon: Icons.notifications_none_rounded,
        title: 'Select a notification',
        message: 'Pick one from the list to read it here.',
      );
    }
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        Row(
          children: [
            CircleAvatar(
              radius: 22,
              backgroundColor: item.read ? AppColors.muted : AppColors.accent,
              child: Icon(
                _iconFor(item.type),
                size: 22,
                color: item.read
                    ? AppColors.mutedForeground
                    : AppColors.onAccent,
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Text(
                item.title,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          formatDateTime(item.createdAt),
          style: const TextStyle(
            color: AppColors.mutedForeground,
            fontSize: 13,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        if (item.body != null && item.body!.isNotEmpty)
          Text(item.body!, style: const TextStyle(fontSize: 15, height: 1.5)),
        const SizedBox(height: AppSpacing.lg),
        Text(
          item.read ? 'Read' : 'Unread',
          style: const TextStyle(
            color: AppColors.mutedForeground,
            fontSize: 13,
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(notificationsProvider);
    ref.listen(notificationsProvider.select((s) => s.error), (prev, error) {
      if (error == null || prev == error) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(content: Text('Could not update notifications')),
        );
    });

    final controller = ref.read(notificationsProvider.notifier);
    final expanded = Breakpoints.isExpanded(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          if (state.unread > 0)
            TextButton(
              onPressed: () => unawaited(controller.markAllRead()),
              child: const Text('Mark all read'),
            ),
        ],
      ),
      body: state.loading && state.items.isEmpty
          ? const _ListSkeleton()
          : state.error != null && state.items.isEmpty
          ? ErrorView(error: state.error, onRetry: controller.load)
          : state.items.isEmpty
          ? const EmptyState(
              icon: Icons.notifications_none_rounded,
              title: 'No notifications',
              message: 'Order updates and delivery alerts will appear here.',
            )
          : expanded
          ? Row(
              children: [
                SizedBox(width: 360, child: _list(state, controller)),
                const VerticalDivider(width: 1, thickness: 1),
                Expanded(child: _detail()),
              ],
            )
          : _list(state, controller),
    );
  }
}

class _ListSkeleton extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) => ListView.separated(
    padding: const EdgeInsets.all(AppSpacing.md),
    itemCount: 8,
    separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.md),
    itemBuilder: (_, _) =>
        const SkeletonBox(height: 72, width: double.infinity),
  );
}
