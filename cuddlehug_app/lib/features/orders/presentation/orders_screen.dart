import 'dart:async';

import 'package:cuddlehug_app/core/routing/route_paths.dart';
import 'package:cuddlehug_app/core/theme/colors.dart';
import 'package:cuddlehug_app/core/theme/spacing.dart';
import 'package:cuddlehug_app/core/utils/formatters.dart';
import 'package:cuddlehug_app/core/widgets/empty_state.dart';
import 'package:cuddlehug_app/core/widgets/error_view.dart';
import 'package:cuddlehug_app/core/widgets/network_image_view.dart';
import 'package:cuddlehug_app/core/widgets/skeleton_box.dart';
import 'package:cuddlehug_app/features/orders/application/orders_controller.dart';
import 'package:cuddlehug_app/features/orders/data/models/order.dart';
import 'package:cuddlehug_app/features/orders/presentation/order_status.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Order history (`/orders`, protected) with infinite scroll.
class OrdersScreen extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(ordersProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('My orders')),
      body: state.loading && state.items.isEmpty
          ? const _OrdersSkeleton()
          : state.error != null && state.items.isEmpty
          ? ErrorView(
              error: state.error,
              onRetry: () =>
                  unawaited(ref.read(ordersProvider.notifier).load()),
            )
          : state.isEmpty
          ? EmptyState(
              icon: Icons.receipt_long_outlined,
              title: 'No orders yet',
              message:
                  'Your cuddly companions will show up here once you order.',
              actionLabel: 'Start shopping',
              onAction: () => context.go(RoutePaths.shop),
            )
          : NotificationListener<ScrollNotification>(
              onNotification: (notification) {
                if (notification.depth == 0 &&
                    notification.metrics.pixels >=
                        notification.metrics.maxScrollExtent - 300) {
                  unawaited(ref.read(ordersProvider.notifier).loadMore());
                }
                return false;
              },
              child: ListView.separated(
                padding: const EdgeInsets.all(AppSpacing.lg),
                itemCount: state.items.length + (state.hasMore ? 1 : 0),
                separatorBuilder: (_, _) =>
                    const SizedBox(height: AppSpacing.md),
                itemBuilder: (context, index) {
                  if (index >= state.items.length) {
                    return const Center(
                      child: Padding(
                        padding: EdgeInsets.all(AppSpacing.lg),
                        child: SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(strokeWidth: 2.5),
                        ),
                      ),
                    );
                  }
                  return _OrderCard(order: state.items[index]);
                },
              ),
            ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  const new({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    final color = orderStatusColor(order.status);
    return InkWell(
      borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
      onTap: () => context.push(RoutePaths.orderDetail(order.id)),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: AppColors.card,
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    orderStatusLabel(order.status),
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: color,
                    ),
                  ),
                ),
                const Spacer(),
                Text(
                  formatDate(order.createdAt),
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.mutedForeground,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                for (final item in order.items.take(3)) ...[
                  ClipRRect(
                    borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                    child: NetworkImageView(
                      url: item.imageUrl,
                      width: 40,
                      height: 40,
                    ),
                  ),
                  const SizedBox(width: 6),
                ],
                const Spacer(),
                Text(
                  formatMoney(order.totalMoney),
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppColors.foreground,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Expanded(
                  child: Text(
                    order.orderNumber,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.foreground,
                    ),
                  ),
                ),
                Text(
                  '${order.items.length} item${order.items.length == 1 ? '' : 's'}',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.mutedForeground,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _OrdersSkeleton extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(AppSpacing.lg),
    children: [
      for (var i = 0; i < 5; i++)
        const Padding(
          padding: EdgeInsets.only(bottom: AppSpacing.md),
          child: SkeletonBox(width: double.infinity, height: 120),
        ),
    ],
  );
}
