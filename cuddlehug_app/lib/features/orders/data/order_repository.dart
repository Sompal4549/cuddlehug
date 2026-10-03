import 'package:cuddlehug_app/app_providers.dart';
import 'package:cuddlehug_app/core/network/api_endpoints.dart';
import 'package:cuddlehug_app/core/network/dio_client.dart';
import 'package:cuddlehug_app/core/network/paged.dart';
import 'package:cuddlehug_app/features/orders/data/models/order.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Order history read APIs (`/api/orders`, all `requireAuth`). Order
/// creation lives in the checkout flow (Sprint 5).
final orderRepositoryProvider = Provider<OrderRepository>(
  (ref) => OrderRepository(ref.watch(dioClientProvider)),
);

class OrderRepository {
  new(this._client);

  final DioClient _client;

  Future<Paged<Order>> list({int page = 1, int limit = 12}) async {
    final result = await _client.get<List<Order>>(
      ApiEndpoints.orders,
      query: {'page': page, 'limit': limit},
      decode: (json) => ((json! as Map<String, dynamic>)['items']
                  as List<dynamic>? ??
              const <dynamic>[])
          .map<Order>((item) => Order.fromJson(item as Map<String, dynamic>))
          .toList(),
    );
    return Paged(
      items: result.data,
      meta: PaginationMeta.fromJson(result.meta ?? const {}),
    );
  }

  Future<Order> getById(String id) async {
    final result = await _client.get<Order>(
      ApiEndpoints.orderById(id),
      decode: (json) => Order.fromJson(json! as Map<String, dynamic>),
    );
    return result.data;
  }

  Future<OrderStats> stats() async {
    final result = await _client.get<OrderStats>(
      ApiEndpoints.ordersStats,
      decode: (json) => OrderStats.fromJson(json! as Map<String, dynamic>),
    );
    return result.data;
  }
}
