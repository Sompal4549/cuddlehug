import 'package:cuddlehug_app/core/security/log_sanitizer.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSJ9.abcDEF-123_x';

  group('sanitize', () {
    test('redacts a JWT-shaped token anywhere in free text', () {
      expect(
        LogSanitizer.sanitize('401 on /orders with $jwt attached'),
        '401 on /orders with *** attached',
      );
    });

    test('redacts key=value pairs whose key smells like a secret', () {
      expect(
        LogSanitizer.sanitize('failed password=hunter2 for ada'),
        'failed password=*** for ada',
      );
      expect(LogSanitizer.sanitize('accessToken=abc'), 'accessToken=***');
      expect(LogSanitizer.sanitize('ch_refresh=abc'), 'ch_refresh=***');
      expect(LogSanitizer.sanitize('apiKey=abc'), 'apiKey=***');
    });

    test('redacts a secret hiding behind a "key: value" prefix', () {
      expect(
        LogSanitizer.sanitize('Exception: token=abc for ada'),
        'Exception: token=*** for ada',
      );
      expect(
        LogSanitizer.sanitize('ApiException: password: hunter2'),
        'ApiException: password=***',
      );
    });

    test('keeps non-sensitive key=value pairs readable', () {
      expect(
        LogSanitizer.sanitize('retry attempt=2 reason=503'),
        'retry attempt=2 reason=503',
      );
    });

    test('masks the local part of an e-mail but keeps the domain', () {
      expect(
        LogSanitizer.sanitize('login failed for ada.lovelace@example.com'),
        'login failed for a***@example.com',
      );
    });

    test('is a no-op for plain messages', () {
      expect(LogSanitizer.sanitize('request timed out'), 'request timed out');
    });
  });

  group('sanitizeUri', () {
    test('keeps the path but redacts a token query parameter', () {
      final uri = LogSanitizer.sanitizeUri(
        Uri.parse('https://api.cuddlehug.com/api/orders?token=abc&page=2'),
      );

      expect(uri.path, '/api/orders');
      expect(uri.queryParameters['token'], LogSanitizer.hidden);
      expect(uri.queryParameters['page'], '2');
    });

    test('leaves a query-less URI untouched', () {
      final uri = Uri.parse('https://api.cuddlehug.com/api/cart');
      expect(LogSanitizer.sanitizeUri(uri), uri);
    });
  });

  group('sanitizeField', () {
    test('hides a sensitive key regardless of the value type', () {
      expect(
        LogSanitizer.sanitizeField('password', 'hunter2'),
        LogSanitizer.hidden,
      );
      expect(
        LogSanitizer.sanitizeField('accessToken', 42),
        LogSanitizer.hidden,
      );
    });

    test('passes non-string values through unchanged', () {
      expect(LogSanitizer.sanitizeField('statusCode', 503), 503);
      expect(LogSanitizer.sanitizeField('retryable', true), true);
      expect(LogSanitizer.sanitizeField('latencyMs', null), isNull);
    });

    test('runs string values through the text sanitizer', () {
      expect(
        LogSanitizer.sanitizeField('reason', 'token=abc and $jwt'),
        'token=*** and ***',
      );
    });
  });
}
