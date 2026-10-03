import 'dart:async';

import 'package:cuddlehug_app/core/storage/auth_session.dart';
import 'package:dio/dio.dart';

/// Attaches the in-memory access token as `Authorization: Bearer …` and
/// implements the race-safe refresh path (plan §5.3):
///
/// 1. On a *session* 401 (`INVALID_TOKEN`/`UNAUTHORIZED` — never a login
///    failure), call the injected refresher exactly once (single-flight).
/// 2. On success, replay the original request a single time.
/// 3. On a dead refresh token, expire the session so the app routes to login.
/// 4. On a transient refresher failure (network/5xx), keep the session and
///    surface the original error — an outage must not force a logout.
class AuthInterceptor extends Interceptor {
  new(this._session);

  final AuthSession _session;

  /// Injected by `DioClient` wiring after construction (the refresher lives
  /// in the auth feature, which depends on this client).
  Future<bool> Function()? refresher;

  /// The owning client — set by `DioClient` so replays share its pipeline.
  Dio? client;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final token = _session.accessToken;
    if (token != null && token.isNotEmpty && !_isSessionCall(options)) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    unawaited(_handleError(err, handler));
  }

  Future<void> _handleError(DioException err, ErrorInterceptorHandler handler) async {
    final options = err.requestOptions;
    if (!_shouldRefresh(err) || options.extra[_retriedKey] == true || refresher == null) {
      handler.next(err);
      return;
    }

    final bool refreshed;
    try {
      refreshed = await refresher!();
    } on Object {
      // Transient refresh failure — keep the session, report the original
      // error (the request can be retried once connectivity returns).
      handler.next(err);
      return;
    }
    if (!refreshed) {
      _session.expire();
      handler.next(err);
      return;
    }

    final token = _session.accessToken;
    options.extra[_retriedKey] = true;
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    final dio = client;
    if (dio == null) {
      handler.next(err);
      return;
    }
    try {
      final response = await dio.fetch<dynamic>(options);
      handler.resolve(response);
    } on DioException catch (replayError) {
      handler.next(replayError);
    }
  }

  bool _shouldRefresh(DioException err) {
    if (err.response?.statusCode != 401) return false;
    if (_isSessionCall(err.requestOptions)) return false;
    // Wrong password / validation on auth endpoints must not trigger refresh.
    final body = err.response?.data;
    final code = body is Map<String, dynamic> ? body['code'] : null;
    return code == 'INVALID_TOKEN' || code == 'UNAUTHORIZED' || code == null;
  }

  static const _retriedKey = 'auth_retried';

  static bool _isSessionCall(RequestOptions options) =>
      options.extra['skip_auth'] == true ||
      options.path.contains('/auth/refresh') ||
      options.path.contains('/auth/login') ||
      options.path.contains('/auth/register');
}
