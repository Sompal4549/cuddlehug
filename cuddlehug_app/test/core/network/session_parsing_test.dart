import 'dart:convert';

import 'package:cuddlehug_app/core/network/cookie_parser.dart';
import 'package:cuddlehug_app/core/utils/jwt.dart';
import 'package:flutter_test/flutter_test.dart';

String _jwtWithExp(int expSeconds) {
  String segment(Object payload) => base64Url
      .encode(utf8.encode(payload is String ? payload : ''))
      .replaceAll('=', '');
  final header = segment('{"alg":"HS256","typ":"JWT"}');
  final payload = segment('{"sub":"u1","exp":$expSeconds}');
  return '$header.$payload.signature';
}

void main() {
  test('parses ch_refresh from set-cookie headers', () {
    final headers = [
      'ch_sid=abc; Path=/; Expires=Wed, 01 Oct 2026 00:00:00 GMT',
      'ch_refresh=eyJhbGciOiJIUzI1NiJ9.abc.def; Path=/; HttpOnly; Max-Age=2592000',
    ];
    expect(parseRefreshCookie(headers), 'eyJhbGciOiJIUzI1NiJ9.abc.def');
  });

  test('returns null when no ch_refresh is present', () {
    expect(parseRefreshCookie(null), isNull);
    expect(parseRefreshCookie(['ch_sid=abc; Path=/']), isNull);
    expect(parseRefreshCookie(const ['ch_refresh=; Path=/']), isNull);
  });

  test('reads exp from an access token payload', () {
    final exp = DateTime.utc(2026, 10, 2).millisecondsSinceEpoch ~/ 1000;
    final expiry = accessTokenExpiry(_jwtWithExp(exp));
    expect(expiry, DateTime.fromMillisecondsSinceEpoch(exp * 1000, isUtc: true));
  });

  test('returns null for malformed tokens', () {
    expect(accessTokenExpiry('not-a-jwt'), isNull);
    expect(accessTokenExpiry('a.b'), isNull);
    expect(accessTokenExpiry('a.###.c'), isNull);
    expect(accessTokenExpiry('a.eyJub19leHAiOjF9.c'), isNull);
  });
}
