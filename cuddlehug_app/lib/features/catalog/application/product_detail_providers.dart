import 'package:cuddlehug_app/features/catalog/data/catalog_repository.dart';
import 'package:cuddlehug_app/features/catalog/data/models/product.dart';
import 'package:cuddlehug_app/features/catalog/data/models/product_detail.dart';
import 'package:cuddlehug_app/features/catalog/data/models/review.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';

final FutureProviderFamily<ProductDetail, String> productDetailProvider =
    FutureProvider.family<ProductDetail, String>(
  (ref, slug) => ref.watch(catalogRepositoryProvider).productDetail(slug),
);

final FutureProviderFamily<List<ProductCard>, String> relatedProductsProvider =
    FutureProvider.family<List<ProductCard>, String>(
  (ref, slug) => ref.watch(catalogRepositoryProvider).related(slug),
);

/// First page of approved reviews plus the rating distribution.
final FutureProviderFamily<ReviewPage, String> productReviewsProvider = FutureProvider.family<ReviewPage, String>(
  (ref, productId) => ref.watch(catalogRepositoryProvider).reviews(productId),
);
