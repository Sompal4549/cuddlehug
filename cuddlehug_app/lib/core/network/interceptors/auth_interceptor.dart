import 'dart:async';

import 'package:cuddlehug_app/core/storage/auth_session.dart';
import 'package:dio/dio.dart';

/// Attaches the in-memory access token as `Authorization: Bearer …` and
/// implements the race-safe refresh path (plan §5.3).
///
/// **Why `onResponse` and not `onError`.** `DioClient` configures
/// `validateStatus: status < 600` so that *every* HTTP status is delivered
/// to the response chain and the API envelope (not Dio) decides success.
/// A 401 therefore never becomes a `DioException`, and reacting to it in
/// `onError` would silently never run — refresh must happen here.
///
/// The state machine:
///
/// 1. On a *session* 401 (`INVALID_TOKEN`/`UNAUTHORIZED` — never a login
///    failure), call the injected refresher. The refresher is single-flight
///    in the auth repository, so N simultaneous 401s collapse into exactly
///    one refresh request and all N replays share its result.
/// 2. On success, replay the original request **once**. The [replayKey]
///    guard makes a second 401 terminal instead of starting another
///    refresh, so `401 → refresh → 401 → refresh → …` cannot happen.
/// 3. On a dead refresh token, expire the session **once** so the app
///    routes to login with the intended destination preserved.
/// 4. On a transient refresher failure (network/5xx), keep the session and
///    surface the original error — an outage must not force a logout.
/// 5. Once [AuthSession.isExpired] is set, no further refresh is attempted
///    until a fresh access token arrives (login), which caps the whole path
///    at one refresh attempt per session generation.
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
  void onResponse(
    Response<dynamic> response,
    ResponseInterceptorHandler handler,
  ) {
    if (!_shouldRefresh(response)) {
      handler.next(response);
      return;
    }
    unawaited(_refreshAndReplay(response, handler));
  }

  Future<void> _refreshAndReplay(
    Response<dynamic> response,
    ResponseInterceptorHandler handler,
  ) async {
    final options = response.requestOptions;

    final bool refreshed;
    try {
      refreshed = await refresher!();
    } on Object {
      // Transient refresh failure — keep the session, report the original
      // error (the request can be retried once connectivity returns).
      handler.next(response);
      return;
    }
    if (!refreshed) {
      // Single-fire: no-op for guests and on every call after the first.
      _session.expire();
      handler.next(response);
      return;
    }

    final token = _session.accessToken;
    options.extra[replayKey] = true;
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    final dio = client;
    if (dio == null) {
      handler.next(response);
      return;
    }
    try {
      handler.resolve(await dio.fetch<dynamic>(options));
    } on DioException catch (replayError) {
      // Transport failure during the replay: hand it back as an error so
      // the rest of the pipeline (retry policy) still gets its turn.
      handler.reject(replayError, true);
    }
  }

  bool _shouldRefresh(Response<dynamic> response) {
    if (response.statusCode != 401) return false;
    if (refresher == null) return false;
    // Already refreshed once for this request — the second 401 is final.
    if (response.requestOptions.extra[replayKey] == true) return false;
    // Session already proved dead — do not hammer the refresh endpoint.
    if (_session.isExpired) return false;
    if (_isSessionCall(response.requestOptions)) return false;
    // Wrong password / validation on auth endpoints must not trigger refresh.
    final body = response.data;
    final code = body is Map<String, dynamic> ? body['code'] : null;
    return code == 'INVALID_TOKEN' || code == 'UNAUTHORIZED' || code == null;
  }

  /// Marks a request that has already been replayed after a refresh.
  static const replayKey = 'auth_retried';

  static bool _isSessionCall(RequestOptions options) =>
      options.extra['skip_auth'] == true ||
      options.path.contains('/auth/refresh') ||
      options.path.contains('/auth/login') ||
      options.path.contains('/auth/register');
}
