import 'dart:async';

import 'package:cuddlehug_app/app_providers.dart';
import 'package:cuddlehug_app/core/network/api_endpoints.dart';
import 'package:cuddlehug_app/core/network/api_exception.dart';
import 'package:cuddlehug_app/core/network/cookie_parser.dart';
import 'package:cuddlehug_app/core/network/dio_client.dart';
import 'package:cuddlehug_app/core/storage/auth_session.dart';
import 'package:cuddlehug_app/core/storage/prefs_store.dart';
import 'package:cuddlehug_app/core/storage/secure_store.dart';
import 'package:cuddlehug_app/features/auth/data/models/user.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class AuthResult {
  const new({required this.user, required this.accessToken});

  final User user;
  final String accessToken;
}

abstract interface class AuthRepository {
  Future<User> login({required String email, required String password});

  Future<User> register({
    required String firstName,
    required String lastName,
    required String email,
    required String password,
    String? phone,
  });

  /// Silent refresh (plan §5.3, single-flight).
  ///
  /// Returns the fresh user, `null` when the refresh token is dead (storage
  /// cleared), or throws [ApiException] for transient failures — callers must
  /// NOT log the user out when it throws.
  Future<User?> refreshSilently();

  Future<void> logout();

  /// Returns the response payload — carries `devToken` in dev builds so the
  /// flow can be completed without a real mailbox.
  Future<Map<String, dynamic>> forgotPassword(String email);

  Future<void> resetPassword({required String token, required String password});
}

class DioAuthRepository implements AuthRepository {
  new({
    required this._dio,
    required this._session,
    required this._store,
    required this._prefs,
  });

  final DioClient _dio;
  final AuthSession _session;
  final SecureStore _store;
  final PrefsStore _prefs;

  Future<User?>? _refreshInflight;

  @override
  Future<User> login({required String email, required String password}) async {
    final response = await _dio.post<AuthResult>(
      ApiEndpoints.login,
      body: {'email': email, 'password': password, 'remember': true},
      decode: _decodeAuthResult,
    );
    final user = await _establish(response);
    return user;
  }

  @override
  Future<User> register({
    required String firstName,
    required String lastName,
    required String email,
    required String password,
    String? phone,
  }) async {
    final response = await _dio.post<AuthResult>(
      ApiEndpoints.register,
      body: {
        'firstName': firstName,
        'lastName': lastName,
        'email': email,
        'password': password,
        if (phone != null && phone.trim().isNotEmpty) 'phone': phone.trim(),
      },
      decode: _decodeAuthResult,
    );
    final user = await _establish(response);
    return user;
  }

  @override
  Future<User?> refreshSilently() =>
      _refreshInflight ??= _doRefresh().whenComplete(() => _refreshInflight = null);

  Future<User?> _doRefresh() async {
    final token = _store.refreshToken;
    if (token == null) return null;
    try {
      final response = await _dio.post<AuthResult>(
        ApiEndpoints.refresh,
        body: {'refreshToken': token},
        decode: _decodeAuthResult,
      );
      return await _establish(response);
    } on ApiException catch (error) {
      if (error.isUnauthorized || error.status == 403 || error.code == 'INVALID_TOKEN') {
        // Revoked/expired refresh token — clear local session material.
        await _store.clearRefreshToken();
        await _prefs.clearUserSnapshot();
        return null;
      }
      // Transient failure (network/5xx): keep the token, let the caller
      // decide — an outage must not force a logout.
      rethrow;
    }
  }

  @override
  Future<void> logout() async {
    final token = _store.refreshToken;
    // Best-effort server-side revocation; local state clears regardless.
    try {
      await _dio.post<Object?>(
        ApiEndpoints.logout,
        body: {'refreshToken': ?token},
        decode: (data) => data,
      );
    } on ApiException {
      // Session may already be revoked — nothing to do.
    }
    _session.clear();
    await _store.clearRefreshToken();
    await _prefs.clearUserSnapshot();
  }

  @override
  Future<Map<String, dynamic>> forgotPassword(String email) async {
    final response = await _dio.post<Object?>(
      ApiEndpoints.forgotPassword,
      body: {'email': email},
      decode: (data) => data,
    );
    final data = response.data;
    return data is Map<String, dynamic> ? data : <String, dynamic>{};
  }

  @override
  Future<void> resetPassword({required String token, required String password}) async {
    await _dio.post<Object?>(
      ApiEndpoints.resetPassword,
      body: {'token': token, 'password': password},
      decode: (data) => data,
    );
  }

  /// Applies a successful auth response: access token → RAM, user snapshot →
  /// prefs, rotated refresh cookie → secure storage (keep old if not rotated).
  Future<User> _establish(ApiResult<AuthResult> response) async {
    final result = response.data;
    _session.accessToken = result.accessToken;
    final rotated = parseRefreshCookie(response.headers?['set-cookie']);
    if (rotated != null) await _store.writeRefreshToken(rotated);
    await _prefs.writeUserSnapshot(result.user.toJson());
    return result.user;
  }

  static AuthResult _decodeAuthResult(Object? data) {
    if (data is! Map<String, dynamic>) {
      throw const ApiException(
        message: 'Unexpected login response',
        code: 'MALFORMED_RESPONSE',
      );
    }
    return AuthResult(
      user: User.fromJson(data['user'] as Map<String, dynamic>),
      accessToken: data['accessToken'] as String,
    );
  }
}

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  final dio = ref.watch(dioClientProvider);
  final repository = DioAuthRepository(
    dio: dio,
    session: ref.watch(authSessionProvider),
    store: ref.watch(secureStoreProvider),
    prefs: ref.watch(prefsStoreProvider),
  );
  // The 401-refresh hook is injected here instead of in `dioClientProvider`
  // so the two providers don't form a type-inference cycle.
  dio.sessionRefresher = () async => (await repository.refreshSilently()) != null;
  return repository;
});
