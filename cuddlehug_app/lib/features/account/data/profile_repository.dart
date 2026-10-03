import 'package:cuddlehug_app/app_providers.dart';
import 'package:cuddlehug_app/core/network/api_endpoints.dart';
import 'package:cuddlehug_app/core/network/dio_client.dart';
import 'package:cuddlehug_app/features/account/data/models/profile.dart';
import 'package:cuddlehug_app/features/auth/data/models/user.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Profile reads/writes (`/api/profile`, all `requireAuth`).
final profileRepositoryProvider = Provider<ProfileRepository>(
  (ref) => ProfileRepository(ref.watch(dioClientProvider)),
);

class ProfileRepository {
  new(this._client);

  final DioClient _client;

  Future<ProfileResponse> getProfile() async {
    final result = await _client.get<ProfileResponse>(
      ApiEndpoints.profile,
      decode: (json) => ProfileResponse.fromJson(json! as Map<String, dynamic>),
    );
    return result.data;
  }

  Future<User> updateProfile({
    String? firstName,
    String? lastName,
    String? phone,
    String? avatarUrl,
  }) async {
    final result = await _client.patch<Map<String, dynamic>>(
      ApiEndpoints.profile,
      decode: (json) => json! as Map<String, dynamic>,
      body: <String, Object?>{
        'firstName': ?firstName,
        'lastName': ?lastName,
        'phone': ?phone,
        'avatarUrl': ?avatarUrl,
      },
    );
    return User.fromJson(result.data['user']! as Map<String, dynamic>);
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    await _client.patch<dynamic>(
      ApiEndpoints.changePassword,
      decode: (json) => json,
      body: <String, Object?>{
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      },
    );
  }
}
