import 'package:cuddlehug_app/features/catalog/data/catalog_repository.dart';
import 'package:cuddlehug_app/features/catalog/data/models/category.dart';
import 'package:cuddlehug_app/features/catalog/data/models/home_content.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';

/// Single-round-trip home payload (`GET /api/content/home`).
final homeContentProvider = FutureProvider<HomeContent>(
  (ref) => ref.watch(catalogRepositoryProvider).home(),
);

/// All active categories (`GET /api/categories`).
final categoriesProvider = FutureProvider<List<ShopCategory>>(
  (ref) => ref.watch(catalogRepositoryProvider).categories(),
);

/// One category by slug (`GET /api/categories/:slug`).
final FutureProviderFamily<ShopCategory, String> categoryProvider = FutureProvider.family<ShopCategory, String>(
  (ref, slug) => ref.watch(catalogRepositoryProvider).category(slug),
);
