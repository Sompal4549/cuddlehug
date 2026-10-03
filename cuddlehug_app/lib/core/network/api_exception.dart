/// Uniform error type every repository throws.
///
/// HTTP error envelopes (`{success:false,message,code}`) and transport
/// failures (no connection, timeouts) both surface as [ApiException] so the
/// UI only handles one type — mirrors the web app's `ApiError` codes.
class ApiException implements Exception {
  const new({
    required this.message,
    this.code = 'UNKNOWN',
    this.status = 0,
    this.details,
  });

  /// Server-synthesized for transport failures (plan §4.2 error taxonomy).
  factory network(Object cause) => ApiException(
        message: 'Could not reach CuddleHug. Check your connection and try again.',
        code: 'NETWORK_ERROR',
        details: cause.toString(),
      );

  final String message;
  final String code;
  final int status;
  final Object? details;

  bool get isNetwork => code == 'NETWORK_ERROR';
  bool get isUnauthorized => status == 401;
  bool get isValidation => code == 'VALIDATION_ERROR';
  bool get isRateLimited => status == 429;

  @override
  String toString() => 'ApiException($status $code): $message';
}
