import 'package:cuddlehug_app/app_providers.dart';
import 'package:cuddlehug_app/core/network/api_endpoints.dart';
import 'package:cuddlehug_app/core/network/dio_client.dart';
import 'package:cuddlehug_app/core/network/paged.dart';
import 'package:cuddlehug_app/features/catalog/data/models/category.dart';
import 'package:cuddlehug_app/features/catalog/data/models/home_content.dart';
import 'package:cuddlehug_app/features/catalog/data/models/product.dart';
import 'package:cuddlehug_app/features/catalog/data/models/product_detail.dart';
import 'package:cuddlehug_app/features/catalog/data/models/product_query.dart';
import 'package:cuddlehug_app/features/catalog/data/models/review.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final catalogRepositoryProvider = Provider<CatalogRepository>(
  (ref) => CatalogRepository(ref.watch(dioClientProvider)),
);

/// Catalog reads (plan §4.3 endpoint map). All list payloads use the
/// backend's `{items:[…]}` shape; `meta` rides beside `data`.
class CatalogRepository {
  new(this._client);

  final DioClient _client;

  Future<Paged<ProductCard>> listProducts(ProductQuery query) async {
    final result = await _client.get<List<ProductCard>>(
      ApiEndpoints.products,
      query: query.toMap(),
      decode: (json) => _itemList(json, ProductCard.fromJson),
    );
    return Paged(
      items: result.data,
      meta: PaginationMeta.fromJson(result.meta ?? const {}),
    );
  }

  Future<List<ProductCard>> featured({int limit = 8}) =>
      _cardList(ApiEndpoints.productsFeatured, limit: limit);

  Future<List<ProductCard>> bestSellers({int limit = 8}) =>
      _cardList(ApiEndpoints.productsBestSellers, limit: limit);

  Future<List<ProductCard>> newArrivals({int limit = 8}) =>
      _cardList(ApiEndpoints.productsNewArrivals, limit: limit);

  Future<List<ProductCard>> related(String slug, {int limit = 6}) =>
      _cardList(ApiEndpoints.relatedProducts(slug), limit: limit);

  Future<ProductDetail> productDetail(String slug) async {
    final result = await _client.get<ProductDetail>(
      ApiEndpoints.productBySlug(slug),
      decode: (json) => ProductDetail.fromJson(json! as Map<String, dynamic>),
    );
    return result.data;
  }

  Future<List<ShopCategory>> categories() async {
    final result = await _client.get<List<ShopCategory>>(
      ApiEndpoints.categories,
      decode: (json) => _itemList(json, ShopCategory.fromJson),
    );
    return result.data;
  }

  Future<ShopCategory> category(String slug) async {
    final result = await _client.get<ShopCategory>(
      ApiEndpoints.categoryBySlug(slug),
      decode: (json) => ShopCategory.fromJson(json! as Map<String, dynamic>),
    );
    return result.data;
  }

  Future<HomeContent> home() async {
    final result = await _client.get<HomeContent>(
      ApiEndpoints.homeContent,
      decode: (json) => HomeContent.fromJson(json! as Map<String, dynamic>),
    );
    return result.data;
  }

  Future<ReviewPage> reviews(
    String productId, {
    int page = 1,
    int limit = 12,
  }) async {
    final result = await _client.get<ReviewPage>(
      ApiEndpoints.productReviews(productId),
      query: {'page': page, 'limit': limit},
      decode: (json) => ReviewPage.fromJson(json! as Map<String, dynamic>),
    );
    return ReviewPage(
      items: result.data.items,
      distribution: result.data.distribution,
      meta: PaginationMeta.fromJson(result.meta ?? const {}),
    );
  }

  Future<List<ProductCard>> _cardList(String path, {required int limit}) async {
    final result = await _client.get<List<ProductCard>>(
      path,
      query: {'limit': limit},
      decode: (json) => _itemList(json, ProductCard.fromJson),
    );
    return result.data;
  }

  /// Decodes the backend's `{items:[…]}` envelope into typed rows.
  static List<T> _itemList<T>(
    Object? json,
    T Function(Map<String, dynamic>) fromJson,
  ) => ((json! as Map<String, dynamic>)['items']! as List<dynamic>)
      .map<T>((item) => fromJson(item as Map<String, dynamic>))
      .toList();
}
