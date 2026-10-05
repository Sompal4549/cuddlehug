import 'dart:async';

import 'package:cuddlehug_app/core/routing/route_paths.dart';
import 'package:cuddlehug_app/core/theme/colors.dart';
import 'package:cuddlehug_app/core/theme/spacing.dart';
import 'package:cuddlehug_app/features/catalog/application/catalog_providers.dart';
import 'package:cuddlehug_app/features/catalog/application/product_list_controller.dart';
import 'package:cuddlehug_app/features/catalog/application/wishlist_controller.dart';
import 'package:cuddlehug_app/features/catalog/data/models/product_query.dart';
import 'package:cuddlehug_app/features/catalog/presentation/widgets/filter_sheet.dart';
import 'package:cuddlehug_app/features/catalog/presentation/widgets/product_list_body.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Shop tab: category chips, sort menu, filter sheet and the paginated
/// product grid (plan §6).
class ShopScreen extends ConsumerStatefulWidget {
  const new({super.key});

  @override
  ConsumerState<ShopScreen> createState() => _ShopScreenState();
}

class _ShopScreenState extends ConsumerState<ShopScreen> {
  static const _scope = 'shop';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      unawaited(
        ref
            .read(productListProvider(_scope).notifier)
            .applyQuery(const ProductQuery()),
      );
    });
  }

  Future<void> _openFilters(ProductQuery current) async {
    final updated = await showProductFilterSheet(context, current);
    if (updated != null && mounted) {
      await ref
          .read(productListProvider(_scope).notifier)
          .applyQuery(updated, force: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(productListProvider(_scope));
    final categories = ref.watch(categoriesProvider);
    final hasWishlist = ref.watch(
      wishlistProvider.select((wish) => wish.productIds.isNotEmpty),
    );

    return Scaffold(
      appBar: AppBar(
        title: const Text('Shop'),
        actions: [
          IconButton(
            tooltip: 'Search',
            onPressed: () => context.push(RoutePaths.search),
            icon: const Icon(Icons.search_rounded),
          ),
          IconButton(
            tooltip: 'Wishlist',
            onPressed: () => context.push(RoutePaths.wishlist),
            icon: Badge(
              isLabelVisible: hasWishlist,
              child: Icon(
                hasWishlist
                    ? Icons.favorite_rounded
                    : Icons.favorite_outline_rounded,
              ),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          if (categories.value?.isNotEmpty ?? false)
            SizedBox(
              height: 48,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                children: [
                  for (final category in categories.value!)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(category.name),
                        selected: state.query.category == category.slug,
                        onSelected: (_) => ref
                            .read(productListProvider(_scope).notifier)
                            .applyQuery(
                              state.query.copyWithCategory(category.slug),
                              force: true,
                            ),
                      ),
                    ),
                ],
              ),
            ),
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.lg,
              vertical: AppSpacing.xs,
            ),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _openFilters(state.query),
                    icon: const Icon(Icons.tune_rounded, size: 18),
                    label: Text(
                      state.query.activeFilterCount > 0
                          ? 'Filters (${state.query.activeFilterCount})'
                          : 'Filters',
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: PopupMenuButton<ProductSort>(
                    padding: EdgeInsets.zero,
                    tooltip: 'Sort',
                    onSelected: (sort) => ref
                        .read(productListProvider(_scope).notifier)
                        .applyQuery(
                          ProductQuery(
                            search: state.query.search,
                            category: state.query.category,
                            minPrice: state.query.minPrice,
                            maxPrice: state.query.maxPrice,
                            sizes: state.query.sizes,
                            colors: state.query.colors,
                            rating: state.query.rating,
                            availability: state.query.availability,
                            sort: sort,
                          ),
                          force: true,
                        ),
                    itemBuilder: (context) => [
                      for (final sort in ProductSort.values)
                        PopupMenuItem(
                          value: sort,
                          child: Row(
                            children: [
                              if (sort == state.query.sort)
                                const Icon(
                                  Icons.check_rounded,
                                  size: 18,
                                  color: AppColors.primary,
                                )
                              else
                                const SizedBox(width: 18),
                              const SizedBox(width: 8),
                              Text(sort.label),
                            ],
                          ),
                        ),
                    ],
                    child: OutlinedButton.icon(
                      onPressed: () {},
                      icon: const Icon(Icons.swap_vert_rounded, size: 18),
                      label: Text(
                        state.query.sort.label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          const Expanded(child: ProductListBody(scope: _scope)),
        ],
      ),
    );
  }
}

extension on ProductQuery {
  /// Category chip selection: clears the category when tapping the active
  /// chip; other filters stay untouched.
  ProductQuery copyWithCategory(String? slug) => ProductQuery(
    search: search,
    category: slug == category ? null : slug,
    minPrice: minPrice,
    maxPrice: maxPrice,
    sizes: sizes,
    colors: colors,
    rating: rating,
    availability: availability,
    sort: sort,
  );
}
