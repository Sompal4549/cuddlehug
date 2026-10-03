import 'package:cuddlehug_app/app_providers.dart';
import 'package:cuddlehug_app/core/network/api_endpoints.dart';
import 'package:cuddlehug_app/core/network/dio_client.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Device-token registration (`/api/devices`, `requireAuth`).
final deviceRepositoryProvider = Provider<DeviceRepository>(
  (ref) => DeviceRepository(ref.watch(dioClientProvider)),
);

class DeviceRepository {
  new(this._client);

  final DioClient _client;

  Future<void> register({
    required String token,
    required String platform,
    String? appId,
  }) async {
    await _client.post<dynamic>(
      ApiEndpoints.deviceRegister,
      decode: (json) => json,
      body: <String, Object?>{
        'token': token,
        'platform': platform, // 'IOS' | 'ANDROID' | 'WEB'
        'appId': ?appId,
      },
    );
  }

  Future<void> unregister({required String token}) async {
    await _client.post<dynamic>(
      ApiEndpoints.deviceUnregister,
      decode: (json) => json,
      body: <String, Object?>{'token': token},
    );
  }
}
