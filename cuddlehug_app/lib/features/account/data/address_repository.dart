import 'package:cuddlehug_app/app_providers.dart';
import 'package:cuddlehug_app/core/network/api_endpoints.dart';
import 'package:cuddlehug_app/core/network/dio_client.dart';
import 'package:cuddlehug_app/features/account/data/models/address.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Saved-address CRUD (`/api/addresses`, all `requireAuth`).
final addressRepositoryProvider = Provider<AddressRepository>(
  (ref) => AddressRepository(ref.watch(dioClientProvider)),
);

class AddressRepository {
  new(this._client);

  final DioClient _client;

  Future<List<Address>> list() async {
    final result = await _client.get<List<Address>>(
      ApiEndpoints.addresses,
      decode: (json) => ((json! as Map<String, dynamic>)['items']
                  as List<dynamic>? ??
              const <dynamic>[])
          .map<Address>((item) => Address.fromJson(item as Map<String, dynamic>))
          .toList(),
    );
    return result.data;
  }

  Future<Address> create(AddressInput input) => _write(
        ApiEndpoints.addresses,
        body: input.toJson(),
        isPatch: false,
      );

  Future<Address> update(String id, AddressInput input) => _write(
        '${ApiEndpoints.addresses}/$id',
        body: input.toJson(),
        isPatch: true,
      );

  Future<void> remove(String id) async {
    await _client.delete<dynamic>(
      '${ApiEndpoints.addresses}/$id',
      decode: (json) => json,
    );
  }

  Future<void> setDefault(String id) async {
    await _client.post<dynamic>(
      '${ApiEndpoints.addresses}/$id/default',
      decode: (json) => json,
    );
  }

  Future<Address> _write(
    String path, {
    required Object? body,
    required bool isPatch,
  }) async {
    Address decode(Object? json) =>
        Address.fromJson(json! as Map<String, dynamic>);
    final result = isPatch
        ? await _client.patch<Address>(path, decode: decode, body: body)
        : await _client.post<Address>(path, decode: decode, body: body);
    return result.data;
  }
}
