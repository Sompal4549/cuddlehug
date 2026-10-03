import 'package:cuddlehug_app/app_providers.dart';
import 'package:cuddlehug_app/core/network/api_endpoints.dart';
import 'package:cuddlehug_app/core/network/dio_client.dart';
import 'package:cuddlehug_app/core/network/paged.dart';
import 'package:cuddlehug_app/features/catalog/data/models/wishlist_item.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final wishlistRepositoryProvider = Provider<WishlistRepository>(
  (ref) => WishlistRepository(ref.watch(dioClientProvider)),
);

/// Wishlist endpoints — all require a signed-in customer
/// (`requireAuth` on the backend router).
class WishlistRepository {
  new(this._client);

  final DioClient _client;

  Future<Paged<WishlistItem>> list({int page = 1, int limit = 12}) async {
    final result = await _client.get<List<WishlistItem>>(
      ApiEndpoints.wishlist,
      query: {'page': page, 'limit': limit},
      decode: (json) => ((json! as Map<String, dynamic>)['items']!
              as List<dynamic>)
          .map<WishlistItem>(
            (item) => WishlistItem.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
    );
    return Paged(
      items: result.data,
      meta: PaginationMeta.fromJson(result.meta ?? const {}),
    );
  }

  /// Returns `true` when the product was newly added (backend reports
  /// `added:false` when it was already in the list).
  Future<bool> add(String productId) async {
    final result = await _client.post<bool>(
      ApiEndpoints.wishlist,
      body: {'productId': productId},
      decode: (json) => (json! as Map<String, dynamic>)['added'] == true,
    );
    return result.data;
  }

  Future<bool> remove(String productId) async {
    final result = await _client.delete<bool>(
      '${ApiEndpoints.wishlist}/$productId',
      decode: (json) => (json! as Map<String, dynamic>)['removed'] == true,
    );
    return result.data;
  }

  Future<bool> check(String productId) async {
    final result = await _client.get<bool>(
      ApiEndpoints.wishlistCheck(productId),
      decode: (json) => (json! as Map<String, dynamic>)['inWishlist'] == true,
    );
    return result.data;
  }
}
