/// Redaction helpers for everything that can reach a log sink.
///
/// The app's structural rule is already "never log headers or bodies" — this
/// type is the second line of defence for the cases that *are* logged
/// (URLs, error messages, telemetry fields). It strips:
///
/// * `Authorization` / `Cookie` style header values,
/// * query parameters whose name smells like a secret (`token`, `password`,
///   `signature`, …),
/// * inline `key=value` pairs inside free-form messages,
/// * JWT-shaped strings (`eyJ…​.….…`),
/// * e-mail addresses (local part masked).
///
/// It deliberately does NOT try to be a parser — it only ever *removes*
/// material, so a sanitizer bug can never leak a secret.
abstract final class LogSanitizer {
  /// Placeholder written in place of every redacted value.
  static const hidden = '***';

  /// Query/header/message keys whose value must never be logged.
  static const sensitiveKeys = <String>{
    'token',
    'accesstoken',
    'access_token',
    'refreshToken',
    'refresh_token',
    'idtoken',
    'id_token',
    'authorization',
    'cookie',
    'set-cookie',
    'setcookie',
    'password',
    'passwd',
    'secret',
    'apikey',
    'api_key',
    'signature',
    'otp',
    'cvv',
    'pan',
    'sid',
    'session',
    'sessionid',
    'session_id',
    'ch_sid',
    'ch_refresh',
    'refreshtoken',
  };

  static final _jwtPattern = RegExp(
    r'eyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}',
  );

  static final _emailPattern = RegExp(
    r'([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})',
  );

  /// `key=value` pairs embedded in free-form text.
  ///
  /// The value deliberately stops at `?`, `=`, `&` and `,` so that a full
  /// URL (`https://host/path?token=x`) is scanned key-by-key instead of
  /// being swallowed whole by the `https:` key.
  ///
  /// Assigned pairs are matched **before** `key: value` pairs: in
  /// `Exception: token=abc` a greedy colon rule would otherwise pair
  /// `Exception:` with the value `token` and walk past the secret.
  static final _assignPattern = RegExp(
    r'''([A-Za-z_][A-Za-z0-9_-]*)=([^\s,;&=?"']+)''',
    caseSensitive: false,
  );

  /// Matches only the `key:` prefix (never the value) so the scan can resume
  /// immediately after the colon. Pairing the value in the regex itself would
  /// swallow `password` from `ApiException: password: hunter2` and hide the
  /// real secret from the next match.
  static final _colonPattern = RegExp(
    r'([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*',
    caseSensitive: false,
  );

  static final _valuePattern = RegExp(r'''[^\s,;&=?'"]+''');

  /// Redacts the query string of [uri] while keeping its path intact so
  /// logs still show *which* endpoint was called.
  static Uri sanitizeUri(Uri uri) {
    if (uri.queryParameters.isEmpty && !uri.hasQuery) return uri;
    final params = <String, String>{
      for (final entry in uri.queryParameters.entries)
        entry.key: _isSensitive(entry.key) ? hidden : _text(entry.value),
    };
    return uri.replace(queryParameters: params.isEmpty ? null : params);
  }

  /// Redacts a free-form string (error message, telemetry field, …).
  static String sanitize(String input) => _text(input);

  /// Redacts a single field value carried in a telemetry map.
  static Object? sanitizeField(String key, Object? value) {
    if (_isSensitive(key)) return hidden;
    if (value is String) return _text(value);
    return value;
  }

  static bool _isSensitive(String key) => sensitiveKeys.contains(
    key.toLowerCase().replaceAll(RegExp('[^a-z_]'), ''),
  );

  static String _text(String input) {
    var out = input.replaceAll(_jwtPattern, hidden);
    // Assigned pairs first: in `Exception: token=abc` a colon rule would
    // otherwise pair `Exception:` with the value `token` and walk past it.
    out = out.replaceAllMapped(
      _assignPattern,
      (match) => _isSensitive(match.group(1)!)
          ? '${match.group(1)}=$hidden'
          : match.group(0)!,
    );
    out = _redactColons(out);
    out = out.replaceAllMapped(
      _emailPattern,
      (match) => '${match.group(1)}***@${match.group(2)}',
    );
    return out;
  }

  /// Walks `key: value` pairs, consuming the value only for sensitive keys.
  static String _redactColons(String input) {
    final buffer = StringBuffer();
    var index = 0;
    while (index < input.length) {
      final match = _colonPattern.firstMatch(input.substring(index));
      if (match == null) break;
      final start = index + match.start;
      final end = index + match.end;
      final key = match.group(1)!;
      if (_isSensitive(key)) {
        final value = _valuePattern.firstMatch(input.substring(end));
        final consumeEnd = value == null ? end : end + value.end;
        buffer
          ..write(input.substring(index, start))
          ..write('$key=$hidden');
        index = consumeEnd;
      } else {
        // Resume right after the colon so a nested `key: value` gets its own
        // chance to be recognised.
        buffer.write(input.substring(index, end));
        index = end;
      }
    }
    buffer.write(input.substring(index));
    return buffer.toString();
  }
}
