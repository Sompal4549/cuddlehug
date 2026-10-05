import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart';

/// Idempotent-request retry with backoff (plan §4.2 / §10.3).
///
/// **Method policy** — only `GET` is ever retried. `POST`/`PUT`/`PATCH`/
/// `DELETE` may create or move money/state, so they are never auto-retried
/// unless a specific call is designed to be idempotent and opts in through
/// its own repository logic (e.g. `Idempotency-Key` on order creation).
///
/// **Status policy** — only transient gateway/edge failures are retried:
///
/// | retried | not retried |
/// |---|---|
/// | 502, 503, 504 | 400, 401, 403, 404, 409, 422, 429, 500, 501, 505 |
/// | connection / timeout / socket errors | validation & business errors |
/// | | cancelled requests, bad TLS certificates |
///
/// 401 is deliberately excluded — it is `AuthInterceptor`'s job, and mixing
/// the two would let a refresh failure be retried by this interceptor.
///
/// **Budget** — at most 2 retries per logical request with a `300ms → 1s`
/// backoff. 429 is *not* auto-retried; the UI owns the countdown backoff.
class RetryInterceptor extends Interceptor {
  new({this.client, List<Duration>? delays})
    : delays =
          delays ?? const [Duration(milliseconds: 300), Duration(seconds: 1)];

  /// Owning client — set by `DioClient` so retries share its pipeline
  /// (cookies, auth header, envelope parsing).
  Dio? client;

  /// Backoff schedule; its length is also the retry budget.
  final List<Duration> delays;

  static const attemptKey = 'ch_retry_attempt';

  /// HTTP statuses that mean "try again" rather than "the answer is no".
  static const retryableStatuses = <int>{502, 503, 504};

  @override
  void onResponse(
    Response<dynamic> response,
    ResponseInterceptorHandler handler,
  ) {
    // Budget check happens *here*: once spent, the (possibly 5xx) response
    // passes through untouched and is handed back to the awaiting caller.
    if (!_isRetryableStatus(response.statusCode) ||
        !_canRetry(response.requestOptions) ||
        _exhausted(response.requestOptions)) {
      handler.next(response);
      return;
    }
    unawaited(
      _retry(
        response.requestOptions,
        onOk: handler.resolve,
        onErr: (error) => handler.reject(error, true),
      ),
    );
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (!_isTransient(err) ||
        !_canRetry(err.requestOptions) ||
        _exhausted(err.requestOptions)) {
      handler.next(err);
      return;
    }
    unawaited(
      _retry(err.requestOptions, onOk: handler.resolve, onErr: handler.next),
    );
  }

  /// Re-issues the original request through the full pipeline. The attempt
  /// counter lives on `RequestOptions.extra`, so every nested re-issue sees
  /// it and the budget is spent exactly once (300ms, 1s, then give up — the
  /// nested chain's own entry check hands the failure back unchanged).
  Future<void> _retry(
    RequestOptions options, {
    required void Function(Response<dynamic>) onOk,
    required void Function(DioException) onErr,
  }) async {
    final attempt = (options.extra[attemptKey] as int?) ?? 0;
    options.extra[attemptKey] = attempt + 1;

    await Future<void>.delayed(delays[attempt]);
    try {
      onOk(await client!.fetch<dynamic>(options));
    } on DioException catch (error) {
      onErr(error);
    }
  }

  /// GET only — mutations are never auto-retried by this interceptor.
  bool _canRetry(RequestOptions options) =>
      options.method == 'GET' && client != null;

  /// Retry budget spent (or nothing to retry with).
  bool _exhausted(RequestOptions options) =>
      client == null || _attempt(options) >= delays.length;

  int _attempt(RequestOptions options) =>
      (options.extra[attemptKey] as int?) ?? 0;

  static bool _isRetryableStatus(int? status) =>
      status != null && retryableStatuses.contains(status);

  bool _isTransient(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.transformTimeout:
      case DioExceptionType.connectionError:
        return true;
      case DioExceptionType.unknown:
        // Raw transport failures (no route / socket dropped) surface as
        // `unknown` — retry those, but not parsing bugs or coding errors.
        return error.error is SocketException ||
            error.error is TimeoutException;
      case DioExceptionType.badCertificate:
      // A certificate that fails verification does not heal itself;
      // retrying only delays the real error.
      case DioExceptionType.cancel:
      case DioExceptionType.badResponse:
        return false;
    }
  }
}
