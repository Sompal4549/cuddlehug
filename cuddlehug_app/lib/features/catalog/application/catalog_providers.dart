import 'package:cuddlehug_app/core/cache/ttl_cache.dart';
import 'package:cuddlehug_app/features/catalog/data/catalog_repository.dart';
import 'package:cuddlehug_app/features/catalog/data/models/category.dart';
import 'package:cuddlehug_app/features/catalog/data/models/home_content.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';

/// Cache key for the home payload (scoped by environment inside the cache).
const homeContentCacheKey = 'content:home';

/// Home content → **network-first with a stale fallback** (plan §19): every
/// provider run hits the network so pull-to-refresh always means something,
/// and a failed refresh keeps rendering the last known payload instead of
/// swapping the whole home screen for an error view.
final homeContentProvider = FutureProvider<HomeContent>((ref) async {
  final cache = ref.watch(ttlCacheProvider);
  try {
    final content = await ref.watch(catalogRepositoryProvider).home();
    cache.write(homeContentCacheKey, content, ttl: homeContentTtl);
    return content;
  } catch (_) {
    final stale = cache.readStale<HomeContent>(homeContentCacheKey);
    if (stale != null) return stale;
    rethrow;
  }
});

const homeContentTtl = Duration(minutes: 30);

/// All active categories (`GET /api/categories`) — network-first with the
/// same stale fallback as the home payload.
final categoriesProvider = FutureProvider<List<ShopCategory>>((ref) async {
  final cache = ref.watch(ttlCacheProvider);
  try {
    final categories = await ref.watch(catalogRepositoryProvider).categories();
    cache.write(categoriesCacheKey, categories, ttl: homeContentTtl);
    return categories;
  } catch (_) {
    final stale = cache.readStale<List<ShopCategory>>(categoriesCacheKey);
    if (stale != null) return stale;
    rethrow;
  }
});

const categoriesCacheKey = 'content:categories';

/// One category by slug (`GET /api/categories/:slug`).
final FutureProviderFamily<ShopCategory, String> categoryProvider =
    FutureProvider.family<ShopCategory, String>(
      (ref, slug) => ref.watch(catalogRepositoryProvider).category(slug),
    );
