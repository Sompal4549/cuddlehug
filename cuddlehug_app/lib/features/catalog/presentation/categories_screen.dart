import 'dart:async';

import 'package:cuddlehug_app/core/routing/responsive.dart';
import 'package:cuddlehug_app/core/routing/route_paths.dart';
import 'package:cuddlehug_app/core/theme/colors.dart';
import 'package:cuddlehug_app/core/theme/spacing.dart';
import 'package:cuddlehug_app/core/widgets/network_image_view.dart';
import 'package:cuddlehug_app/features/catalog/application/catalog_providers.dart';
import 'package:cuddlehug_app/features/catalog/application/product_list_controller.dart';
import 'package:cuddlehug_app/features/catalog/data/models/product_query.dart';
import 'package:cuddlehug_app/features/catalog/presentation/widgets/product_list_body.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// All-categories grid (plan §7).
class CategoriesScreen extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final categories = ref.watch(categoriesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Categories')),
      body: categories.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Could not load categories',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 12),
                ElevatedButton(
                  onPressed: () => ref.invalidate(categoriesProvider),
                  child: const Text('Try again'),
                ),
              ],
            ),
          ),
        ),
        data: (items) => GridView.builder(
          padding: const EdgeInsets.all(AppSpacing.lg),
          // Plan §14.1: 2 → 3 → 4 columns by window class.
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: Breakpoints.gridColumns(context),
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            mainAxisExtent: 190,
          ),
          itemCount: items.length,
          itemBuilder: (context, index) {
            final category = items[index];
            return Card(
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: () =>
                    context.push(RoutePaths.categoryLanding(category.slug)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: NetworkImageView(
                        url: category.image,
                        width: double.infinity,
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(AppSpacing.sm + 2),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            category.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: AppColors.foreground,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${category.productCount} products',
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.mutedForeground,
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
        ),
      ),
    );
  }
}

/// Category landing: header + product grid filtered by category slug
/// (plan §7).
class CategoryScreen extends ConsumerStatefulWidget {
  const new({required this.slug, super.key});

  final String slug;

  @override
  ConsumerState<CategoryScreen> createState() => _CategoryScreenState();
}

class _CategoryScreenState extends ConsumerState<CategoryScreen> {
  late final String _scope = 'category:${widget.slug}';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      unawaited(
        ref
            .read(productListProvider(_scope).notifier)
            .applyQuery(ProductQuery(category: widget.slug)),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final category = ref.watch(categoryProvider(widget.slug));
    return Scaffold(
      appBar: AppBar(title: Text(category.value?.name ?? 'Category')),
      body: Column(
        children: [
          if (category.value?.description != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.sm,
                AppSpacing.lg,
                AppSpacing.sm,
              ),
              child: Text(
                category.value!.description!,
                style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.mutedForeground,
                ),
              ),
            )
          else
            const SizedBox.shrink(),
          Expanded(child: ProductListBody(scope: _scope)),
        ],
      ),
    );
  }
}
