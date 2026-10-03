import 'dart:async';

import 'package:cuddlehug_app/core/routing/route_paths.dart';
import 'package:cuddlehug_app/core/theme/colors.dart';
import 'package:cuddlehug_app/core/theme/spacing.dart';
import 'package:cuddlehug_app/core/widgets/network_image_view.dart';
import 'package:cuddlehug_app/core/widgets/price_text.dart';
import 'package:cuddlehug_app/core/widgets/rating_stars.dart';
import 'package:cuddlehug_app/features/auth/application/auth_controller.dart';
import 'package:cuddlehug_app/features/catalog/application/wishlist_controller.dart';
import 'package:cuddlehug_app/features/catalog/data/models/product.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Product tile used in grids and carousels: image with discount badge,
/// wishlist heart, name, rating and price.
class ProductCardTile extends ConsumerWidget {
  const new({required this.product, super.key, this.width});

  final ProductCard product;
  final double? width;

  void _openProduct(BuildContext context) =>
      context.push(RoutePaths.productDetail(product.slug));

  Future<void> _toggleWishlist(BuildContext context, WidgetRef ref) async {
    final authenticated = ref.read(authControllerProvider).isAuthenticated;
    if (!authenticated) {
      final next = Uri.encodeComponent(
        RoutePaths.productDetail(product.slug),
      );
      await context.push('${RoutePaths.login}?next=$next');
      return;
    }
    final wasAdded = await ref
        .read(wishlistProvider.notifier)
        .toggle(product.id);
    if (context.mounted) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            content: Text(
              wasAdded ? 'Added to your wishlist' : 'Removed from your wishlist',
            ),
          ),
        );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final wishlisted = ref.watch(
      wishlistProvider.select((state) => state.contains(product.id)),
    );
    final busy = ref.watch(
      wishlistProvider.select((state) => state.busyIds.contains(product.id)),
    );

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => _openProduct(context),
        child: SizedBox(
          width: width,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AspectRatio(
                aspectRatio: 1,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    NetworkImageView(url: product.image),
                    if (product.hasDiscount)
                      Positioned(
                        left: AppSpacing.sm,
                        top: AppSpacing.sm,
                        child: _Badge(
                          label: '${product.discountPercent}% OFF',
                          color: AppColors.primary,
                        ),
                      ),
                    if (!product.inStock)
                      const Positioned(
                        left: AppSpacing.sm,
                        bottom: AppSpacing.sm,
                        child: _Badge(
                          label: 'OUT OF STOCK',
                          color: AppColors.foreground,
                        ),
                      ),
                    Positioned(
                      right: 4,
                      top: 4,
                      child: IconButton(
                        onPressed: busy
                            ? null
                            : () => unawaited(_toggleWishlist(context, ref)),
                        color: wishlisted
                            ? AppColors.primary
                            : AppColors.mutedForeground,
                        iconSize: 22,
                        style: IconButton.styleFrom(
                          backgroundColor: Colors.white.withValues(alpha: 0.85),
                        ),
                        icon: busy
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : Icon(
                                wishlisted
                                    ? Icons.favorite_rounded
                                    : Icons.favorite_outline_rounded,
                              ),
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(AppSpacing.sm + 2),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
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
                    if (product.ratingCount > 0)
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
                        discountPercent: product.discountPercent,
                        fontSize: 15,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Compact tile for horizontal carousels on the home screen.
class ProductMiniCard extends ConsumerWidget {
  const new({required this.product, super.key, this.width = 160});

  final ProductCard product;
  final double width;

  @override
  Widget build(BuildContext context, WidgetRef ref) => SizedBox(
        width: width,
        child: ProductCardTile(product: product, width: width),
      );
}

class _Badge extends StatelessWidget {
  const new({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
        ),
        child: Text(
          label,
          style: const TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w700,
            color: Colors.white,
          ),
        ),
      );
}
