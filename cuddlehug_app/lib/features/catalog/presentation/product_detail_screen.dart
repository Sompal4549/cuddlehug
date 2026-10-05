import 'dart:async';
import 'dart:math' as math;

import 'package:cuddlehug_app/core/network/api_exception.dart';
import 'package:cuddlehug_app/core/routing/route_paths.dart';
import 'package:cuddlehug_app/core/theme/colors.dart';
import 'package:cuddlehug_app/core/theme/spacing.dart';
import 'package:cuddlehug_app/core/utils/formatters.dart';
import 'package:cuddlehug_app/core/widgets/app_button.dart';
import 'package:cuddlehug_app/core/widgets/error_view.dart';
import 'package:cuddlehug_app/core/widgets/network_image_view.dart';
import 'package:cuddlehug_app/core/widgets/price_text.dart';
import 'package:cuddlehug_app/core/widgets/rating_stars.dart';
import 'package:cuddlehug_app/core/widgets/section_header.dart';
import 'package:cuddlehug_app/core/widgets/skeleton_box.dart';
import 'package:cuddlehug_app/features/auth/application/auth_controller.dart';
import 'package:cuddlehug_app/features/cart/application/cart_controller.dart';
import 'package:cuddlehug_app/features/catalog/application/product_detail_providers.dart';
import 'package:cuddlehug_app/features/catalog/application/wishlist_controller.dart';
import 'package:cuddlehug_app/features/catalog/data/models/product.dart';
import 'package:cuddlehug_app/features/catalog/data/models/product_detail.dart';
import 'package:cuddlehug_app/features/catalog/data/models/review.dart';
import 'package:cuddlehug_app/features/catalog/presentation/widgets/product_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Product detail (plan §8): gallery, variants, attributes, reviews and
/// related products.
class ProductDetailScreen extends ConsumerStatefulWidget {
  const new({required this.slug, super.key});

  final String slug;

  @override
  ConsumerState<ProductDetailScreen> createState() =>
      _ProductDetailScreenState();
}

class _ProductDetailScreenState extends ConsumerState<ProductDetailScreen> {
  final ValueNotifier<ProductVariant?> _selectedVariant =
      ValueNotifier<ProductVariant?>(null);

  @override
  void dispose() {
    _selectedVariant.dispose();
    super.dispose();
  }

  Future<void> _toggleWishlist(ProductDetail product) async {
    final authenticated = ref.read(authControllerProvider).isAuthenticated;
    if (!authenticated) {
      final next = Uri.encodeComponent(RoutePaths.productDetail(product.slug));
      await context.push('${RoutePaths.login}?next=$next');
      return;
    }
    try {
      final added = await ref
          .read(wishlistProvider.notifier)
          .toggle(product.id);
      if (mounted) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(
            SnackBar(
              content: Text(
                added ? 'Added to your wishlist' : 'Removed from your wishlist',
              ),
            ),
          );
      }
    } on Object {
      if (mounted) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(
            const SnackBar(content: Text('Could not update your wishlist')),
          );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final detail = ref.watch(productDetailProvider(widget.slug));
    return Scaffold(
      appBar: AppBar(
        title: Text(detail.value?.name ?? 'Product'),
        actions: [
          detail.when(
            loading: () => const SizedBox.shrink(),
            error: (_, _) => const SizedBox.shrink(),
            data: (product) {
              final wishlisted = ref.watch(
                wishlistProvider.select((state) => state.contains(product.id)),
              );
              final busy = ref.watch(
                wishlistProvider.select(
                  (state) => state.busyIds.contains(product.id),
                ),
              );
              return IconButton(
                tooltip: wishlisted
                    ? 'Remove from wishlist'
                    : 'Add to wishlist',
                onPressed: busy ? null : () => _toggleWishlist(product),
                icon: busy
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Icon(
                        wishlisted
                            ? Icons.favorite_rounded
                            : Icons.favorite_outline_rounded,
                        color: wishlisted ? AppColors.primary : null,
                      ),
              );
            },
          ),
        ],
      ),
      body: detail.when(
        loading: () => const _DetailSkeleton(),
        error: (error, _) => ErrorView(
          error: error,
          onRetry: () => ref.invalidate(productDetailProvider(widget.slug)),
        ),
        data: (product) =>
            _DetailBody(product: product, selectedVariant: _selectedVariant),
      ),
      bottomNavigationBar: detail.value == null
          ? null
          : _AddToCartBar(
              product: detail.value!,
              selectedVariant: _selectedVariant,
            ),
    );
  }
}

class _DetailBody extends StatefulWidget {
  const new({required this.product, required this.selectedVariant});

  final ProductDetail product;
  final ValueNotifier<ProductVariant?> selectedVariant;

  @override
  State<_DetailBody> createState() => _DetailBodyState();
}

class _DetailBodyState extends State<_DetailBody> {
  late String? _size;
  late String? _color;

  List<ProductVariant> get _variants => widget.product.variants;

  List<String> get _sizes {
    final seen = <String>{};
    return [
      for (final variant in _variants)
        if (seen.add(variant.size)) variant.size,
    ];
  }

  List<String> get _colorsForSize => {
    for (final variant in _variants)
      if (_size == null || variant.size == _size) variant.color,
  }.toList();

  ProductVariant? get _selected {
    final size = _size;
    final color = _color;
    for (final variant in _variants) {
      if (size != null &&
          color != null &&
          variant.size == size &&
          variant.color == color) {
        return variant;
      }
      if (size == null && color == null) return variant;
      if (size != null && color == null && variant.size == size) return variant;
    }
    return null;
  }

  @override
  void initState() {
    super.initState();
    final first = _variants.isEmpty
        ? null
        : _variants.firstWhere(
            (variant) => variant.isAvailable,
            orElse: () => _variants.first,
          );
    _size = first?.size;
    _color = first?.color;
    widget.selectedVariant.value = _selected;
  }

  void _syncSelected() => widget.selectedVariant.value = _selected;

  void _selectColor(String color) {
    setState(() => _color = color);
    _syncSelected();
  }

  void _selectSize(String size) {
    setState(() {
      _size = size;
      final colors = {
        for (final variant in _variants)
          if (variant.size == size) variant.color,
      }.toList();
      _color = colors.isEmpty
          ? null
          : colors.firstWhere(
              (color) => _variants.any(
                (variant) =>
                    variant.size == size &&
                    variant.color == color &&
                    variant.isAvailable,
              ),
              orElse: () => colors.first,
            );
    });
    _syncSelected();
  }

  @override
  Widget build(BuildContext context) {
    final product = widget.product;
    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(child: _Gallery(images: product.images)),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.md,
            AppSpacing.lg,
            AppSpacing.xl,
          ),
          sliver: SliverList.list(
            children: [
              Text(
                product.name,
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  color: AppColors.foreground,
                  height: 1.25,
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  RatingStars(
                    value: product.ratingAverage,
                    size: 18,
                    countText: product.ratingCount > 0
                        ? '${product.ratingAverage.toStringAsFixed(1)} (${product.ratingCount} ratings)'
                        : 'No ratings yet',
                  ),
                ],
              ),
              const SizedBox(height: 12),
              PriceText(
                price: _selected?.priceMoney ?? product.priceMoney,
                mrp: _selected?.mrpMoney ?? product.mrpMoney,
                discountPercent: product.discountPercent,
                fontSize: 24,
              ),
              const SizedBox(height: 12),
              _StockChip(variant: _selected, product: product),
              if (_variants.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.lg),
                if (_sizes.length > 1) ...[
                  const _SectionTitle('Size'),
                  const SizedBox(height: AppSpacing.sm),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final size in _sizes)
                        ChoiceChip(
                          label: Text(_titleCase(size)),
                          selected: _size == size,
                          onSelected: (_) => _selectSize(size),
                        ),
                    ],
                  ),
                ],
                if (_colorsForSize.length > 1) ...[
                  const SizedBox(height: AppSpacing.md),
                  const _SectionTitle('Colour'),
                  const SizedBox(height: AppSpacing.sm),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final color in _colorsForSize)
                        ChoiceChip(
                          avatar: CircleAvatar(
                            backgroundColor: _swatch(color),
                            radius: 8,
                          ),
                          label: Text(_titleCase(color)),
                          selected: _color == color,
                          onSelected: (_) => _selectColor(color),
                        ),
                    ],
                  ),
                ],
              ],
              if (product.description.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.lg),
                const _SectionTitle('Description'),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  product.description,
                  style: const TextStyle(
                    fontSize: 14,
                    color: AppColors.foreground,
                    height: 1.55,
                  ),
                ),
              ],
              if (_attributesOf(product).isNotEmpty) ...[
                const SizedBox(height: AppSpacing.lg),
                const _SectionTitle('Details'),
                const SizedBox(height: AppSpacing.sm),
                for (final (label, value) in _attributesOf(product))
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SizedBox(
                          width: 120,
                          child: Text(
                            label,
                            style: const TextStyle(
                              fontSize: 13,
                              color: AppColors.mutedForeground,
                            ),
                          ),
                        ),
                        Expanded(
                          child: Text(
                            value,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppColors.foreground,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
              if (product.tags.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.sm),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (final tag in product.tags)
                      Chip(
                        label: Text(tag),
                        visualDensity: VisualDensity.compact,
                      ),
                  ],
                ),
              ],
            ],
          ),
        ),
        SliverToBoxAdapter(
          child: _ReviewsSection(
            productId: product.id,
            reviewCount: product.ratingCount,
          ),
        ),
        SliverToBoxAdapter(child: _RelatedSection(slug: product.slug)),
        const SliverToBoxAdapter(child: SizedBox(height: AppSpacing.xxl)),
      ],
    );
  }

  static List<(String, String)> _attributesOf(ProductDetail product) => [
    if (product.material != null && product.material!.isNotEmpty)
      ('Material', product.material!),
    if (product.filling != null && product.filling!.isNotEmpty)
      ('Filling', product.filling!),
    if (product.weightGrams != null) ('Weight', '${product.weightGrams} g'),
    if (product.ageRecommendation != null &&
        product.ageRecommendation!.isNotEmpty)
      ('Age', product.ageRecommendation!),
    if (product.careInstructions != null &&
        product.careInstructions!.isNotEmpty)
      ('Care', product.careInstructions!),
  ];
}

class _AddToCartBar extends ConsumerStatefulWidget {
  const new({required this.product, required this.selectedVariant});

  final ProductDetail product;
  final ValueNotifier<ProductVariant?> selectedVariant;

  @override
  ConsumerState<_AddToCartBar> createState() => _AddToCartBarState();
}

class _AddToCartBarState extends ConsumerState<_AddToCartBar> {
  bool _adding = false;

  Future<void> _addToCart() async {
    final variant = widget.selectedVariant.value;
    final messenger = ScaffoldMessenger.of(context);
    if (variant == null) {
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(content: Text('Select a size or colour first')),
        );
      return;
    }
    setState(() => _adding = true);
    try {
      await ref.read(cartProvider.notifier).addItem(variant.id);
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(const SnackBar(content: Text('Added to your cart')));
    } on ApiException catch (error) {
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(error.message)));
    } on Object {
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(content: Text('Could not add to your cart')),
        );
    } finally {
      if (mounted) setState(() => _adding = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final product = widget.product;
    return Container(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.lg,
        AppSpacing.sm,
      ),
      decoration: const BoxDecoration(
        color: AppColors.card,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  PriceText(
                    price: product.priceMoney,
                    mrp: product.mrpMoney,
                    discountPercent: product.discountPercent,
                    fontSize: 17,
                  ),
                  Text(
                    product.inStock ? 'In stock' : 'Out of stock',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: product.inStock
                          ? AppColors.success
                          : AppColors.destructive,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            SizedBox(
              width: 190,
              child: AppButton(
                label: 'Add to cart',
                loading: _adding,
                onPressed: product.inStock ? _addToCart : null,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Gallery extends StatefulWidget {
  const new({required this.images});

  final List<ProductImage> images;

  @override
  State<_Gallery> createState() => _GalleryState();
}

class _GalleryState extends State<_Gallery> {
  final PageController _controller = PageController();
  int _index = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final images = widget.images;
    return LayoutBuilder(
      builder: (context, constraints) {
        final height = math.min<double>(constraints.maxWidth, 400);
        return Column(
          children: [
            SizedBox(
              height: height,
              child: images.isEmpty
                  ? const NetworkImageView(url: null, height: 400)
                  : PageView.builder(
                      controller: _controller,
                      itemCount: images.length,
                      onPageChanged: (page) => setState(() => _index = page),
                      itemBuilder: (context, index) => NetworkImageView(
                        url: images[index].url,
                        height: height,
                      ),
                    ),
            ),
            if (images.length > 1)
              Padding(
                padding: const EdgeInsets.only(top: AppSpacing.sm),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    for (final i in Iterable<int>.generate(images.length))
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        margin: const EdgeInsets.symmetric(horizontal: 3),
                        width: i == _index ? 16 : 6,
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
              ),
          ],
        );
      },
    );
  }
}

class _StockChip extends StatelessWidget {
  const new({required this.variant, required this.product});

  final ProductVariant? variant;
  final ProductDetail product;

  @override
  Widget build(BuildContext context) {
    final available = variant?.available;
    final (text, color) = switch ((variant == null, available ?? 0)) {
      (true, _) =>
        product.inStock
            ? ('In stock', AppColors.success)
            : ('Out of stock', AppColors.destructive),
      (_, 0) => ('Out of stock', AppColors.destructive),
      (_, <= 5) => ('Only $available left — order soon', AppColors.warning),
      _ => ('In stock', AppColors.success),
    };
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
          ),
          child: Text(
            text,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
        ),
      ],
    );
  }
}

class _ReviewsSection extends ConsumerWidget {
  const new({required this.productId, required this.reviewCount});

  final String productId;
  final int reviewCount;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reviews = ref.watch(productReviewsProvider(productId));
    if (reviewCount == 0) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeader(title: 'Reviews'),
        reviews.when(
          loading: () => const Padding(
            padding: EdgeInsets.symmetric(horizontal: AppSpacing.lg),
            child: SkeletonBox(width: double.infinity, height: 80),
          ),
          error: (error, _) => const Padding(
            padding: EdgeInsets.symmetric(horizontal: AppSpacing.lg),
            child: Text(
              'Reviews could not be loaded.',
              style: TextStyle(fontSize: 13, color: AppColors.mutedForeground),
            ),
          ),
          data: (page) => Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (page.distribution.isNotEmpty) ...[
                  for (final star in [5, 4, 3, 2, 1]) ...[
                    Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Row(
                        children: [
                          SizedBox(
                            width: 28,
                            child: Text(
                              '$star★',
                              style: const TextStyle(fontSize: 12),
                            ),
                          ),
                          Expanded(
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(3),
                              child: LinearProgressIndicator(
                                value: page.totalReviews == 0
                                    ? 0
                                    : (page.distribution['$star'] ?? 0) /
                                          page.totalReviews,
                                minHeight: 7,
                                backgroundColor: AppColors.muted,
                                color: AppColors.warning,
                              ),
                            ),
                          ),
                          SizedBox(
                            width: 32,
                            child: Text(
                              '${page.distribution['$star'] ?? 0}',
                              textAlign: TextAlign.end,
                              style: const TextStyle(fontSize: 12),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: AppSpacing.md),
                ],
                if (page.items.isEmpty)
                  const Text(
                    'No reviews yet.',
                    style: TextStyle(
                      fontSize: 13,
                      color: AppColors.mutedForeground,
                    ),
                  )
                else
                  for (final review in page.items) _ReviewTile(review: review),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _ReviewTile extends StatelessWidget {
  const new({required this.review});

  final Review review;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: AppSpacing.md),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            CircleAvatar(
              radius: 14,
              backgroundColor: AppColors.accent,
              child: Text(
                review.user.name.isEmpty
                    ? '?'
                    : review.user.name[0].toUpperCase(),
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.onAccent,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    review.user.name,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.foreground,
                    ),
                  ),
                  Text(
                    formatDateTime(review.createdAt),
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.mutedForeground,
                    ),
                  ),
                ],
              ),
            ),
            RatingStars(value: review.rating.toDouble(), size: 14),
          ],
        ),
        if (review.title != null && review.title!.isNotEmpty) ...[
          const SizedBox(height: 6),
          Text(
            review.title!,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: AppColors.foreground,
            ),
          ),
        ],
        const SizedBox(height: 4),
        Text(
          review.comment,
          style: const TextStyle(
            fontSize: 13,
            color: AppColors.foreground,
            height: 1.45,
          ),
        ),
      ],
    ),
  );
}

class _RelatedSection extends ConsumerWidget {
  const new({required this.slug});

  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final related = ref.watch(relatedProductsProvider(slug));
    return related.maybeWhen(
      data: (products) => products.isEmpty
          ? const SizedBox.shrink()
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SectionHeader(title: 'You may also like'),
                SizedBox(
                  height: 300,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.lg,
                    ),
                    itemCount: products.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 12),
                    itemBuilder: (context, index) =>
                        ProductMiniCard(product: products[index]),
                  ),
                ),
              ],
            ),
      orElse: () => const SizedBox.shrink(),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const new(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Text(
    text,
    style: const TextStyle(
      fontSize: 15,
      fontWeight: FontWeight.w700,
      color: AppColors.foreground,
    ),
  );
}

class _DetailSkeleton extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(AppSpacing.lg),
    children: const [
      SkeletonBox(width: double.infinity, height: 320),
      SizedBox(height: 16),
      SkeletonBox(width: 240, height: 22),
      SizedBox(height: 10),
      SkeletonBox(width: 160, height: 18),
      SizedBox(height: 16),
      SkeletonBox(width: double.infinity, height: 90),
      SizedBox(height: 16),
      SkeletonBox(width: double.infinity, height: 140),
    ],
  );
}

String _titleCase(String value) => value.isEmpty
    ? value
    : value[0].toUpperCase() + value.substring(1).toLowerCase();

Color _swatch(String color) => switch (color) {
  'BROWN' => const Color(0xFF8D6E63),
  'PINK' => const Color(0xFFF48FB1),
  'WHITE' => const Color(0xFFFAFAFA),
  'CREAM' => const Color(0xFFFFF3E0),
  'RED' => const Color(0xFFE57373),
  _ => AppColors.border,
};
