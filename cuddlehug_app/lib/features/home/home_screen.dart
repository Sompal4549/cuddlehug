import 'package:cuddlehug_app/core/routing/route_paths.dart';
import 'package:cuddlehug_app/core/theme/colors.dart';
import 'package:cuddlehug_app/core/theme/spacing.dart';
import 'package:cuddlehug_app/core/widgets/error_view.dart';
import 'package:cuddlehug_app/core/widgets/network_image_view.dart';
import 'package:cuddlehug_app/core/widgets/section_header.dart';
import 'package:cuddlehug_app/core/widgets/skeleton_box.dart';
import 'package:cuddlehug_app/features/catalog/application/catalog_providers.dart';
import 'package:cuddlehug_app/features/catalog/data/models/category.dart';
import 'package:cuddlehug_app/features/catalog/data/models/home_content.dart';
import 'package:cuddlehug_app/features/catalog/data/models/product.dart';
import 'package:cuddlehug_app/features/catalog/presentation/widgets/product_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Storefront home: hero carousel, categories and three product carousels
/// served by a single `/api/content/home` round trip (plan §7).
class HomeScreen extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final home = ref.watch(homeContentProvider);
    return Scaffold(
      appBar: AppBar(
        title: Text(
          home.value?.storeName ?? 'CuddleHug',
        ),
      ),
      body: home.when(
        loading: () => const _HomeSkeleton(),
        error: (error, _) => ErrorView(
          error: error,
          onRetry: () => ref.invalidate(homeContentProvider),
        ),
        data: (content) => RefreshIndicator(
          onRefresh: () => ref.refresh(homeContentProvider.future),
          child: _HomeBody(content: content),
        ),
      ),
    );
  }
}

class _HomeBody extends StatelessWidget {
  const new({required this.content});

  final HomeContent content;

  void _goShop(BuildContext context) => context.go(RoutePaths.shop);

  @override
  Widget build(BuildContext context) {
    final shipping = content.settings['shipping.freeThreshold'];
    return ListView(
      padding: const EdgeInsets.only(bottom: AppSpacing.xxl),
      children: [
        if (content.hero.isNotEmpty) ...[
          _HeroCarousel(slides: content.hero),
        ],
        Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.md,
            AppSpacing.lg,
            0,
          ),
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.accent,
              borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.local_shipping_rounded,
                  color: AppColors.onAccent,
                  size: 20,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    shipping != null
                        ? 'Free shipping on orders above ₹$shipping'
                        : content.tagline,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.onAccent,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        if (content.categories.isNotEmpty) ...[
          SectionHeader(
            title: 'Shop by category',
            actionLabel: 'See all',
            onAction: () => context.push(RoutePaths.categories),
          ),
          SizedBox(
            height: 132,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              itemCount: content.categories.length,
              separatorBuilder: (_, _) => const SizedBox(width: 12),
              itemBuilder: (context, index) =>
                  _CategoryTile(category: content.categories[index]),
            ),
          ),
        ],
        if (content.featured.isNotEmpty) ...[
          SectionHeader(
            title: 'Featured for you',
            actionLabel: 'See all',
            onAction: () => _goShop(context),
          ),
          _ProductRow(products: content.featured),
        ],
        if (content.bestSellers.isNotEmpty) ...[
          const SectionHeader(title: 'Best sellers'),
          _ProductRow(products: content.bestSellers),
        ],
        if (content.newArrivals.isNotEmpty) ...[
          const SectionHeader(title: 'New arrivals'),
          _ProductRow(products: content.newArrivals),
        ],
      ],
    );
  }
}

class _HeroCarousel extends StatefulWidget {
  const new({required this.slides});

  final List<HeroSlide> slides;

  @override
  State<_HeroCarousel> createState() => _HeroCarouselState();
}

class _HeroCarouselState extends State<_HeroCarousel> {
  final PageController _controller = PageController();
  int _index = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Column(
        children: [
          SizedBox(
            height: 190,
            child: PageView.builder(
              controller: _controller,
              itemCount: widget.slides.length,
              onPageChanged: (page) => setState(() => _index = page),
              itemBuilder: (context, index) => Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.lg,
                  vertical: AppSpacing.sm,
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
                  child: NetworkImageView(
                    url: widget.slides[index].image,
                    height: 180,
                  ),
                ),
              ),
            ),
          ),
          if (widget.slides.length > 1)
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (final i in Iterable<int>.generate(widget.slides.length))
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    width: i == _index ? 18 : 6,
                    height: 6,
                    decoration: BoxDecoration(
                      color: i == _index
                          ? AppColors.primary
                          : AppColors.border,
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
              ],
            ),
        ],
      );
}

class _CategoryTile extends StatelessWidget {
  const new({required this.category});

  final ShopCategory category;

  @override
  Widget build(BuildContext context) => SizedBox(
        width: 96,
        child: InkWell(
          onTap: () => context.push(RoutePaths.categoryLanding(category.slug)),
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          child: Column(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                child: NetworkImageView(
                  url: category.image,
                  width: 96,
                  height: 96,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                category.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.foreground,
                ),
              ),
            ],
          ),
        ),
      );
}

class _ProductRow extends StatelessWidget {
  const new({required this.products});

  final List<ProductCard> products;

  @override
  Widget build(BuildContext context) => SizedBox(
        height: 300,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
          itemCount: products.length,
          separatorBuilder: (_, _) => const SizedBox(width: 12),
          itemBuilder: (context, index) =>
              ProductMiniCard(product: products[index]),
        ),
      );
}

class _HomeSkeleton extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) => ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: const [
          SkeletonBox(width: double.infinity, height: 180),
          SizedBox(height: 16),
          SkeletonBox(width: 200, height: 18),
          SizedBox(height: 12),
          Row(
            children: [
              SkeletonBox(width: 96, height: 120),
              SizedBox(width: 12),
              SkeletonBox(width: 96, height: 120),
              SizedBox(width: 12),
              SkeletonBox(width: 96, height: 120),
            ],
          ),
          SizedBox(height: 24),
          SkeletonBox(width: 160, height: 18),
          SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: SkeletonBox(width: double.infinity, height: 240)),
              SizedBox(width: 12),
              Expanded(child: SkeletonBox(width: double.infinity, height: 240)),
            ],
          ),
        ],
      );
}
