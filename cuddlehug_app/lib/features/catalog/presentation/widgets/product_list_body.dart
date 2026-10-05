import 'dart:async';

import 'package:cuddlehug_app/core/routing/responsive.dart';
import 'package:cuddlehug_app/core/theme/spacing.dart';
import 'package:cuddlehug_app/core/widgets/empty_state.dart';
import 'package:cuddlehug_app/core/widgets/error_view.dart';
import 'package:cuddlehug_app/core/widgets/skeleton_box.dart';
import 'package:cuddlehug_app/features/catalog/application/product_list_controller.dart';
import 'package:cuddlehug_app/features/catalog/presentation/widgets/product_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Shared scrolling body for shop, category and search lists: skeleton
/// loading, error/empty states, responsive grid and infinite scroll
/// (plan §6 responsiveness).
class ProductListBody extends ConsumerWidget {
  const new({required this.scope, super.key});

  final String scope;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(productListProvider(scope));
    final controller = ref.read(productListProvider(scope).notifier);

    return NotificationListener<ScrollNotification>(
      onNotification: (notification) {
        if (notification.depth == 0 &&
            notification.metrics.pixels >=
                notification.metrics.maxScrollExtent - 600) {
          unawaited(controller.loadMore());
        }
        return false;
      },
      child: LayoutBuilder(
        builder: (context, constraints) {
          // Plan §14.1: 2 → 3 → 4 columns across compact/medium/expanded.
          final columns = constraints.maxWidth < Breakpoints.compactMax
              ? 2
              : constraints.maxWidth < Breakpoints.expandedMin
              ? 3
              : 4;
          // Square image + fixed text block — derives the cell height from
          // the actual cell width so wide tablets never overflow.
          const spacing = 12.0;
          const padding = 2 * AppSpacing.lg;
          final cellWidth =
              (constraints.maxWidth - padding - spacing * (columns - 1)) /
              columns;
          final cellExtent = cellWidth + 110;
          if (state.initialLoading) return _skeletonGrid(columns, cellExtent);
          if (state.error != null && state.items.isEmpty) {
            return ErrorView(
              error: state.error,
              onRetry: () => controller.applyQuery(state.query, force: true),
            );
          }
          if (state.isEmpty) {
            return const EmptyState(
              icon: Icons.search_off_rounded,
              title: 'No products found',
              message: 'Try adjusting your filters or search terms.',
            );
          }
          return CustomScrollView(
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg,
                  AppSpacing.md,
                  AppSpacing.lg,
                  AppSpacing.xl,
                ),
                sliver: SliverGrid(
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: columns,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    mainAxisExtent: cellExtent,
                  ),
                  delegate: SliverChildBuilderDelegate(
                    (context, index) =>
                        ProductCardTile(product: state.items[index]),
                    childCount: state.items.length,
                  ),
                ),
              ),
              if (state.loadingMore)
                const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.only(bottom: AppSpacing.xl),
                    child: Center(
                      child: SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(strokeWidth: 2.5),
                      ),
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }

  Widget _skeletonGrid(int columns, double cellExtent) => GridView.builder(
    padding: const EdgeInsets.all(AppSpacing.lg),
    physics: const NeverScrollableScrollPhysics(),
    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
      crossAxisCount: columns,
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      mainAxisExtent: cellExtent,
    ),
    itemCount: columns * 2,
    itemBuilder: (context, _) => const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SkeletonBox(width: double.infinity, height: 150),
        SizedBox(height: 10),
        SkeletonBox(width: 140, height: 14),
        SizedBox(height: 8),
        SkeletonBox(width: 90, height: 14),
      ],
    ),
  );
}
