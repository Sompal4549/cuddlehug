import 'package:cuddlehug_app/core/network/api_exception.dart';

/// The backend's response envelope: `{success,data,meta?}` or
/// `{success:false,message,code,details?}`.
class ApiEnvelope<T> {
  const new _({
    required this.success,
    this.data,
    this.meta,
    this.message,
    this.code,
    this.details,
  });

  final bool success;
  final T? data;
  final Map<String, dynamic>? meta;
  final String? message;
  final String? code;
  final Object? details;

  /// Parses a successful response body, throwing [ApiException] for the
  /// error envelope or a malformed payload.
  static T unwrap<T>(
    Object? body,
    T Function(Object? data) map, {
    required int status,
  }) {
    if (body is! Map<String, dynamic>) {
      throw ApiException(
        message: 'Unexpected server response',
        code: 'MALFORMED_RESPONSE',
        status: status,
        details: body,
      );
    }
    final success = body['success'] == true;
    if (!success) {
      throw ApiException(
        message: (body['message'] as String?) ?? 'Something went wrong',
        code: (body['code'] as String?) ?? 'UNKNOWN',
        status: status,
        details: body['details'],
      );
    }
    return map(body['data']);
  }

  /// Like [unwrap] but also returns `meta` (pagination).
  static (T, Map<String, dynamic>?) unwrapPaged<T>(
    Object? body,
    T Function(Object? data) map, {
    required int status,
  }) {
    final data = unwrap(body, map, status: status);
    final meta = body is Map<String, dynamic> && body['meta'] is Map<String, dynamic>
        ? body['meta'] as Map<String, dynamic>
        : null;
    return (data, meta);
  }
}
