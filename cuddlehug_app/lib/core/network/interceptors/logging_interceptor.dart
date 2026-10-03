import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

/// Debug-only request/response logging (plan §4.2). Never prints headers or
/// bodies, so no secret can leak; registered only when
/// `AppConfig.enableLogging` is true (off in production builds).
class LoggingInterceptor extends Interceptor {
  const new();

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    assert(() {
      debugPrint('→ ${options.method} ${options.uri}');
      return true;
    }(), 'request log');
    handler.next(options);
  }

  @override
  void onResponse(Response<dynamic> response, ResponseInterceptorHandler handler) {
    assert(() {
      debugPrint('← ${response.statusCode} ${response.requestOptions.uri}');
      return true;
    }(), 'response log');
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    assert(() {
      debugPrint('← ERROR ${err.response?.statusCode} ${err.requestOptions.uri}: ${err.message}');
      return true;
    }(), 'error log');
    handler.next(err);
  }
}
