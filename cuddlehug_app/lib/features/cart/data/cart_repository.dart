import 'package:cuddlehug_app/app_providers.dart';
import 'package:cuddlehug_app/core/network/api_endpoints.dart';
import 'package:cuddlehug_app/core/network/dio_client.dart';
import 'package:cuddlehug_app/features/cart/data/models/cart.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Cart data access. All mutations return the full updated [Cart] — the
/// backend echoes the cart DTO on every `/api/cart*` call. The guest cart
/// rides on the `ch_sid` cookie handled by the session middleware client
/// interceptor.
final cartRepositoryProvider = Provider<CartRepository>(
  (ref) => CartRepository(ref.watch(dioClientProvider)),
);

class CartRepository {
  new(this._client);

  final DioClient _client;

  Future<Cart> getCart() => _cart(ApiEndpoints.cart, method: 'GET');

  Future<Cart> addItem({required String variantId, int quantity = 1}) => _cart(
    ApiEndpoints.cartItems,
    method: 'POST',
    body: {'variantId': variantId, 'quantity': quantity},
  );

  /// Quantity `0` deletes the line server-side.
  Future<Cart> updateItem({required String variantId, required int quantity}) =>
      _cart(
        ApiEndpoints.cartItems,
        method: 'PATCH',
        body: {'variantId': variantId, 'quantity': quantity},
      );

  Future<Cart> removeItem(String itemId) =>
      _cart('${ApiEndpoints.cartItems}/$itemId', method: 'DELETE');

  Future<Cart> applyCoupon(String code) =>
      _cart(ApiEndpoints.cartCoupon, method: 'POST', body: {'code': code});

  Future<Cart> removeCoupon() =>
      _cart(ApiEndpoints.cartCoupon, method: 'DELETE');

  Future<Cart> _cart(
    String path, {
    required String method,
    Object? body,
  }) async {
    Cart decode(Object? json) => Cart.fromJson(json! as Map<String, dynamic>);
    final result = method == 'GET'
        ? await _client.get<Cart>(path, decode: decode)
        : method == 'POST'
        ? await _client.post<Cart>(path, decode: decode, body: body)
        : method == 'PATCH'
        ? await _client.patch<Cart>(path, decode: decode, body: body)
        : await _client.delete<Cart>(path, decode: decode);
    return result.data;
  }
}
