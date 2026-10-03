import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart';

/// Idempotent-request retry with backoff (plan §4.2 / §10.3):
/// * **GET only** — mutations are never auto-retried (checkout, payments and
///   cart writes must not double-submit; their buttons disable while in flight).
/// * max 2 retries on transient failures: connection/timeout errors and 5xx.
/// * backoff `300ms → 1s`.
/// * 429 is *not* auto-retried — the UI owns the countdown backoff.
class RetryInterceptor extends Interceptor {
  new({this.client, List<Duration>? delays})
      : delays =
            delays ?? const [Duration(milliseconds: 300), Duration(seconds: 1)];

  /// Owning client — set by `DioClient` so retries share its pipeline
  /// (cookies, auth header, envelope parsing).
  Dio? client;

  /// Backoff schedule; its length is also the retry budget.
  final List<Duration> delays;

  static const _attemptKey = 'ch_retry_attempt';

  @override
  void onResponse(Response<dynamic> response, ResponseInterceptorHandler handler) {
    // Budget check happens *here*: once spent, the (possibly 5xx) response
    // passes through untouched and is handed back to the awaiting caller.
    if (!_isServerError(response) ||
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
    final attempt = (options.extra[_attemptKey] as int?) ?? 0;
    options.extra[_attemptKey] = attempt + 1;

    await Future<void>.delayed(delays[attempt]);
    try {
      onOk(await client!.fetch<dynamic>(options));
    } on DioException catch (error) {
      onErr(error);
    }
  }

  bool _canRetry(RequestOptions options) =>
      options.method == 'GET' && client != null;

  /// Retry budget spent (or nothing to retry with).
  bool _exhausted(RequestOptions options) =>
      client == null || _attempt(options) >= delays.length;

  int _attempt(RequestOptions options) =>
      (options.extra[_attemptKey] as int?) ?? 0;

  bool _isServerError(Response<dynamic> response) {
    final status = response.statusCode;
    return status != null && status >= 500;
  }

  bool _isTransient(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.transformTimeout:
      case DioExceptionType.connectionError:
      case DioExceptionType.badCertificate:
        return true;
      case DioExceptionType.unknown:
        // Raw transport failures (no route / socket dropped) surface as
        // `unknown` — retry those, but not parsing bugs or coding errors.
        return error.error is SocketException || error.error is TimeoutException;
      case DioExceptionType.cancel:
      case DioExceptionType.badResponse:
        return false;
    }
  }
}
