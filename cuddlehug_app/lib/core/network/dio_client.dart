import 'dart:convert' show jsonDecode;

import 'package:cuddlehug_app/core/config/app_config.dart';
import 'package:cuddlehug_app/core/network/api_exception.dart';
import 'package:cuddlehug_app/core/network/envelope.dart';
import 'package:cuddlehug_app/core/network/interceptors/auth_interceptor.dart';
import 'package:cuddlehug_app/core/network/interceptors/cookie_header_interceptor.dart';
import 'package:cuddlehug_app/core/network/interceptors/logging_interceptor.dart';
import 'package:cuddlehug_app/core/network/interceptors/retry_interceptor.dart';
import 'package:cuddlehug_app/core/storage/auth_session.dart';
import 'package:cuddlehug_app/core/storage/secure_store.dart';
import 'package:dio/dio.dart';

class ApiResult<T> {
  const new(this.data, {this.meta, this.headers});

  final T data;
  final Map<String, dynamic>? meta;

  /// Raw response headers — auth flows read rotated `Set-Cookie` values.
  final Headers? headers;
}

typedef JsonDecoder<T> = T Function(Object? json);

/// Singleton HTTP client (plan §4.2).
///
/// Interceptor order: cookie → auth → retry (GET only) → logging (debug only).
class DioClient {
  new({
    required AuthSession authSession,
    required SecureStore secureStore,
    bool? enableLogging,
    String? baseUrl,
  }) : dio = Dio(
          BaseOptions(
            baseUrl: baseUrl ?? AppConfig.current.apiBaseUrl,
            connectTimeout: const Duration(seconds: 15),
            receiveTimeout: const Duration(seconds: 30),
            // Any HTTP status is "successful" at the transport layer — the
            // envelope decides success, so 4xx/5xx error bodies parse the
            // same way as 2xx bodies.
            validateStatus: (status) => status != null && status < 600,
            headers: const {
              'Accept': 'application/json',
            },
          ),
        ) {
    dio.interceptors.add(CookieHeaderInterceptor(secureStore));
    _authInterceptor = AuthInterceptor(authSession)..client = dio;
    dio.interceptors.add(_authInterceptor);
    dio.interceptors.add(RetryInterceptor()..client = dio);
    if (enableLogging ?? AppConfig.current.enableLogging) {
      dio.interceptors.add(const LoggingInterceptor());
    }
  }

  final Dio dio;
  late final AuthInterceptor _authInterceptor;

  /// Injected by app wiring — the refresher lives in the auth feature
  /// (plan §5.3 single-flight refresh on 401).
  Future<bool> Function()? get sessionRefresher => _authInterceptor.refresher;

  set sessionRefresher(Future<bool> Function()? value) => _authInterceptor.refresher = value;

  Future<ApiResult<T>> get<T>(
    String path, {
    required JsonDecoder<T> decode, Map<String, dynamic>? query,
    Map<String, dynamic>? headers,
    CancelToken? cancelToken,
  }) =>
      _request(
        'GET',
        path,
        query: query,
        decode: decode,
        headers: headers,
        cancelToken: cancelToken,
      );

  Future<ApiResult<T>> post<T>(
    String path, {
    required JsonDecoder<T> decode, Object? body,
    Map<String, dynamic>? query,
    Map<String, dynamic>? headers,
    CancelToken? cancelToken,
  }) =>
      _request(
        'POST',
        path,
        body: body,
        query: query,
        decode: decode,
        headers: headers,
        cancelToken: cancelToken,
      );

  Future<ApiResult<T>> patch<T>(
    String path, {
    required JsonDecoder<T> decode, Object? body,
    Map<String, dynamic>? query,
    Map<String, dynamic>? headers,
    CancelToken? cancelToken,
  }) =>
      _request(
        'PATCH',
        path,
        body: body,
        query: query,
        decode: decode,
        headers: headers,
        cancelToken: cancelToken,
      );

  Future<ApiResult<T>> delete<T>(
    String path, {
    required JsonDecoder<T> decode, Object? body,
    Map<String, dynamic>? query,
    Map<String, dynamic>? headers,
    CancelToken? cancelToken,
  }) =>
      _request(
        'DELETE',
        path,
        body: body,
        query: query,
        decode: decode,
        headers: headers,
        cancelToken: cancelToken,
      );

  Future<ApiResult<T>> _request<T>(
    String method,
    String path, {
    required JsonDecoder<T> decode,
    Object? body,
    Map<String, dynamic>? query,
    Map<String, dynamic>? headers,
    CancelToken? cancelToken,
  }) async {
    final Response<dynamic> response;
    try {
      response = await dio.request<dynamic>(
        path,
        data: body,
        queryParameters: _cleanQuery(query),
        cancelToken: cancelToken,
        options: Options(method: method, headers: headers),
      );
    } on DioException catch (error) {
      throw _mapTransport(error);
    }

    final payload = _decodeBody(response.data);
    if (response.statusCode != null && response.statusCode! >= 400) {
      // Error envelope — ApiEnvelope.unwrap throws ApiException.
      ApiEnvelope.unwrap(payload, decode, status: response.statusCode!);
      // Unreachable: an error envelope always throws.
      throw ApiException(message: 'Request failed', status: response.statusCode!);
    }
    final (data, meta) = ApiEnvelope.unwrapPaged(payload, decode, status: response.statusCode ?? 200);
    return ApiResult(data, meta: meta, headers: response.headers);
  }

  static Object? _decodeBody(Object? data) {
    if (data is String) {
      if (data.isEmpty) return null;
      try {
        return jsonDecode(data);
      } on FormatException {
        // Non-JSON body (e.g. an HTML error page) — ApiEnvelope.unwrap will
        // surface it as MALFORMED_RESPONSE.
        return data;
      }
    }
    return data;
  }

  static Map<String, dynamic>? _cleanQuery(Map<String, dynamic>? query) {
    if (query == null) return null;
    return {
      for (final entry in query.entries)
        if (entry.value != null &&
            !(entry.value is String && (entry.value as String).isEmpty))
          entry.key: entry.value,
    };
  }

  static ApiException _mapTransport(DioException error) {
    if (error.type == DioExceptionType.cancel) {
      return const ApiException(message: 'Request cancelled', code: 'REQUEST_CANCELLED');
    }
    return ApiException.network(error);
  }
}
