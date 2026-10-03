/// Extracts the rotated `ch_refresh` value from `Set-Cookie` response
/// headers (plan §5.3 — rotation must be captured, but a parse failure keeps
/// the old token, which is still valid until it expires).
String? parseRefreshCookie(List<String>? setCookieHeaders) {
  if (setCookieHeaders == null) return null;
  final pattern = RegExp(r'(?:^|;\s*)ch_refresh=([^;]*)');
  for (final header in setCookieHeaders) {
    final match = pattern.firstMatch(header);
    final value = match?.group(1);
    if (value != null && value.isNotEmpty) {
      try {
        return Uri.decodeComponent(value);
      } on FormatException {
        return value;
      }
    }
  }
  return null;
}
