import 'package:cuddlehug_app/core/observability/app_logger.dart';
import 'package:cuddlehug_app/core/security/log_sanitizer.dart';
import 'package:dio/dio.dart';

/// Request/response logging for debug builds (plan §4.2).
///
/// Deliberately logs **method + sanitized URL + status only** — never
/// headers, never bodies, never the `Cookie`/`Authorization` pair. The URL
/// itself goes through [LogSanitizer] so a `?token=…` reset link can never
/// end up in a log line.
///
/// Registered only when `AppConfig.enableLogging` is true (off in production
/// builds); the actual `debugPrint` is additionally `assert`-wrapped so it
/// disappears entirely from release binaries.
class LoggingInterceptor extends Interceptor {
  const new();

  static const AppLogger _logger = DebugAppLogger(scope: 'http');

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    _logger.debug(
      '→ ${options.method} ${LogSanitizer.sanitizeUri(options.uri)}',
    );
    handler.next(options);
  }

  @override
  void onResponse(
    Response<dynamic> response,
    ResponseInterceptorHandler handler,
  ) {
    _logger.debug(
      '← ${response.statusCode} '
      '${LogSanitizer.sanitizeUri(response.requestOptions.uri)}',
    );
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    _logger.debug(
      '← ERROR ${err.response?.statusCode ?? err.type.name} '
      '${LogSanitizer.sanitizeUri(err.requestOptions.uri)}',
      fields: {'message': err.message},
    );
    handler.next(err);
  }
}
