import 'dart:convert';

/// Decodes the `exp` claim of an access token (plan §5.3 proactive refresh).
///
/// Signature verification is deliberately skipped — the client only needs the
/// expiry for scheduling; the server remains the authority on validity.
DateTime? accessTokenExpiry(String jwt) {
  try {
    final parts = jwt.split('.');
    if (parts.length != 3) return null;
    final payloadBytes = base64Url.decode(base64Url.normalize(parts[1]));
    final payload = jsonDecode(utf8.decode(payloadBytes));
    if (payload is! Map<String, dynamic>) return null;
    final exp = payload['exp'];
    if (exp is int) {
      return DateTime.fromMillisecondsSinceEpoch(exp * 1000, isUtc: true);
    }
    if (exp is num) {
      return DateTime.fromMillisecondsSinceEpoch(
        exp.toInt() * 1000,
        isUtc: true,
      );
    }
    return null;
  } on FormatException {
    return null;
  }
}
