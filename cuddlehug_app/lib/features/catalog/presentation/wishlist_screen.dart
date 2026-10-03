import 'dart:async';

import 'package:cuddlehug_app/core/routing/responsive.dart';
import 'package:cuddlehug_app/core/routing/route_paths.dart';
import 'package:cuddlehug_app/core/theme/colors.dart';
import 'package:cuddlehug_app/core/theme/spacing.dart';
import 'package:cuddlehug_app/core/widgets/empty_state.dart';
import 'package:cuddlehug_app/core/widgets/network_image_view.dart';
import 'package:cuddlehug_app/core/widgets/price_text.dart';
import 'package:cuddlehug_app/core/widgets/rating_stars.dart';
import 'package:cuddlehug_app/features/catalog/application/wishlist_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Wishlist grid for signed-in customers (plan §10). Route is protected —
/// the router guard bounces guests to login first.
class WishlistScreen extends ConsumerWidget {
  const new({super.key});

  Future<void> _remove(BuildContext context, WidgetRef ref, String productId) async {
    try {
      await ref.read(wishlistProvider.notifier).toggle(productId);
      if (context.mounted) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(
            const SnackBar(content: Text('Removed from your wishlist')),
          );
      }
    } on Object {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(
            const SnackBar(content: Text('Could not update your wishlist')),
          );
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(wishlistProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Wishlist')),
      body: RefreshIndicator(
        onRefresh: () => ref.read(wishlistProvider.notifier).refresh(),
        child: NotificationListener<ScrollNotification>(
          onNotification: (notification) {
            if (notification.depth == 0 &&
                notification.metrics.pixels >=
                    notification.metrics.maxScrollExtent - 500) {
              unawaited(ref.read(wishlistProvider.notifier).loadMore());
            }
            return false;
          },
          child: state.loading && state.items.isEmpty
              ? const Center(child: CircularProgressIndicator())
              : state.error != null && state.items.isEmpty
                  ? ListView(
                      children: const [
                        SizedBox(
                          height: 400,
                          child: EmptyState(
                            icon: Icons.cloud_off_rounded,
                            title: 'Could not load your wishlist',
                            message: 'Pull down to try again.',
                          ),
                        ),
                      ],
                    )
                  : state.isEmpty
                      ? ListView(
                          children: [
                            SizedBox(
                              height: 400,
                              child: EmptyState(
                                title: 'Your wishlist is empty',
                                message:
                                    'Tap the heart on any product to save it here.',
                                actionLabel: 'Start shopping',
                                onAction: () => context.go(RoutePaths.shop),
                              ),
                            ),
                          ],
                        )
                      : LayoutBuilder(
                          builder: (context, constraints) {
                            // Plan §14.1: 2 → 3 → 4 columns by width.
                            final columns =
                                constraints.maxWidth < Breakpoints.compactMax
                                    ? 2
                                    : constraints.maxWidth <
                                            Breakpoints.expandedMin
                                        ? 3
                                        : 4;
                            const spacing = 12.0;
                            final cellWidth =
                                (constraints.maxWidth -
                                        2 * AppSpacing.lg -
                                        spacing * (columns - 1)) /
                                    columns;
                            return GridView.builder(
                          padding: const EdgeInsets.all(AppSpacing.lg),
                          gridDelegate:
                              SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: columns,
                            mainAxisSpacing: spacing,
                            crossAxisSpacing: spacing,
                            mainAxisExtent: cellWidth + 110,
                          ),
                          itemCount: state.items.length,
                          itemBuilder: (context, index) {
                            final item = state.items[index];
                            final product = item.product;
                            return Card(
                              clipBehavior: Clip.antiAlias,
                              child: InkWell(
                                onTap: () => context.push(
                                  RoutePaths.productDetail(product.slug),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    AspectRatio(
                                      aspectRatio: 1,
                                      child: Stack(
                                        fit: StackFit.expand,
                                        children: [
                                          NetworkImageView(url: product.image),
                                          Positioned(
                                            right: 4,
                                            top: 4,
                                            child: IconButton(
                                              tooltip: 'Remove',
                                              onPressed: () => _remove(
                                                context,
                                                ref,
                                                product.id,
                                              ),
                                              style: IconButton.styleFrom(
                                                backgroundColor: Colors.white
                                                    .withValues(alpha: 0.85),
                                              ),
                                              icon: const Icon(
                                                Icons.delete_outline_rounded,
                                                color: AppColors.destructive,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Padding(
                                      padding: const EdgeInsets.all(
                                        AppSpacing.sm + 2,
                                      ),
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            product.name,
                                            maxLines: 2,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(
                                              fontSize: 14,
                                              fontWeight: FontWeight.w600,
                                              color: AppColors.foreground,
                                              height: 1.25,
                                            ),
                                          ),
                                          const SizedBox(height: 6),
                                          RatingStars(
                                            value: product.ratingAverage,
                                            size: 14,
                                            count: product.ratingCount,
                                          ),
                                          const SizedBox(height: 6),
                                          FittedBox(
                                            fit: BoxFit.scaleDown,
                                            alignment: Alignment.centerLeft,
                                            child: PriceText(
                                              price: product.priceMoney,
                                              mrp: product.mrpMoney,
                                              discountPercent:
                                                  product.discountPercent,
                                              fontSize: 15,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                            );
                          },
                        ),
        ),
      ),
    );
  }
}
