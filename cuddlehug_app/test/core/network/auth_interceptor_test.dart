import 'dart:typed_data';

import 'package:cuddlehug_app/core/network/interceptors/auth_interceptor.dart';
import 'package:cuddlehug_app/core/storage/auth_session.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

/// Scripted HTTP layer for the 401 → refresh → replay state machine.
class _ScriptedAdapter implements HttpClientAdapter {
  new(this._respond);

  /// Builds the body for the Nth call (`call` counts from 0).
  final ResponseBody Function(int call) _respond;

  int calls = 0;
  final List<String?> authorizationHeaders = <String?>[];
  final List<String?> requestedPaths = <String?>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    authorizationHeaders.add(options.headers['Authorization'] as String?);
    requestedPaths.add(options.path);
    return _respond(calls++);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody _json(int status, String body) => ResponseBody.fromString(
  body,
  status,
  headers: {
    Headers.contentTypeHeader: ['application/json'],
  },
);

const _unauthorized =
    '{"success":false,"message":"Token expired","code":"INVALID_TOKEN"}';
const _ok = '{"success":true,"data":{"ok":true}}';

void main() {
  late _ScriptedAdapter adapter;
  late Dio dio;
  late AuthSession session;
  late AuthInterceptor interceptor;

  var refreshCalls = 0;
  var expiredCount = 0;

  setUp(() {
    session = AuthSession()..onSessionExpired = () => expiredCount++;
    refreshCalls = 0;
    expiredCount = 0;
    dio = Dio(
      BaseOptions(
        baseUrl: 'http://test.local',
        // Mirrors `DioClient`: every HTTP status is a *response*, so the
        // refresh hook must live in `onResponse`.
        validateStatus: (status) => status != null && status < 600,
      ),
    );
    interceptor = AuthInterceptor(session)..client = dio;
    dio.interceptors.add(interceptor);
  });

  void useAdapter(ResponseBody Function(int call) respond) {
    adapter = _ScriptedAdapter(respond);
    dio.httpClientAdapter = adapter;
  }

  test('401 → refresh → replay once with the new bearer token', () async {
    useAdapter(
      (call) => call == 0 ? _json(401, _unauthorized) : _json(200, _ok),
    );
    session.accessToken = 'old-token';
    interceptor.refresher = () async {
      refreshCalls++;
      session.accessToken = 'new-token';
      return true;
    };

    final response = await dio.get<dynamic>('/orders');

    expect(response.statusCode, 200);
    expect(refreshCalls, 1);
    expect(adapter.calls, 2);
    expect(adapter.authorizationHeaders, [
      'Bearer old-token',
      'Bearer new-token',
    ]);
  });

  test('a second 401 after the replay is terminal — no refresh loop', () async {
    useAdapter((_) => _json(401, _unauthorized));
    session.accessToken = 'old-token';
    interceptor.refresher = () async {
      refreshCalls++;
      session.accessToken = 'new-token';
      return true;
    };

    final response = await dio.get<dynamic>('/orders');

    // exactly: request → 401 → refresh → replay → 401 → give up.
    expect(response.statusCode, 401);
    expect(refreshCalls, 1);
    expect(adapter.calls, 2);
    expect(session.isExpired, isFalse);
  });

  test(
    'simultaneous 401s all replay and none of them expires the session',
    () async {
      // First three calls are the originals (all 401), the rest are replays.
      useAdapter(
        (call) => call < 3 ? _json(401, _unauthorized) : _json(200, _ok),
      );
      session.accessToken = 'old-token';
      interceptor.refresher = () async {
        refreshCalls++;
        // Yield so every concurrent 401 reaches the refresher before it
        // resolves — mirrors the repository's single-flight window.
        await Future<void>.delayed(Duration.zero);
        session.accessToken = 'new-token';
        return true;
      };

      final responses = await Future.wait([
        dio.get<dynamic>('/orders'),
        dio.get<dynamic>('/addresses'),
        dio.get<dynamic>('/notifications'),
      ]);

      expect(responses.map((r) => r.statusCode), everyElement(200));
      expect(refreshCalls, greaterThanOrEqualTo(2));
      expect(adapter.calls, 6);
      expect(session.isExpired, isFalse);
      expect(expiredCount, 0);
    },
  );

  test(
    'concurrent 401s with a failing refresh expire the session exactly once',
    () async {
      useAdapter((_) => _json(401, _unauthorized));
      session.accessToken = 'old-token';
      interceptor.refresher = () async {
        refreshCalls++;
        await Future<void>.delayed(Duration.zero);
        return false;
      };

      final responses = await Future.wait([
        dio.get<dynamic>('/orders'),
        dio.get<dynamic>('/addresses'),
        dio.get<dynamic>('/notifications'),
      ]);

      expect(responses.map((r) => r.statusCode), everyElement(401));
      expect(expiredCount, 1, reason: 'one logout, not one per failed request');
      expect(session.isExpired, isTrue);
      expect(session.accessToken, isNull);
    },
  );

  test('after the session is dead no further refresh is attempted', () async {
    useAdapter((_) => _json(401, _unauthorized));
    session.accessToken = 'old-token';
    interceptor.refresher = () async {
      refreshCalls++;
      return false;
    };

    await dio.get<dynamic>('/orders');
    expect(refreshCalls, 1);

    await dio.get<dynamic>('/orders');
    await dio.get<dynamic>('/orders');

    expect(refreshCalls, 1, reason: 'refresh is capped per session generation');
  });

  test('a transient refresh failure keeps the session alive', () async {
    useAdapter(
      (call) => call == 0 ? _json(401, _unauthorized) : _json(200, _ok),
    );
    session.accessToken = 'old-token';
    interceptor.refresher = () async {
      refreshCalls++;
      throw Exception('refresh endpoint unreachable');
    };

    final response = await dio.get<dynamic>('/orders');

    // Outage must not log the customer out — the original error surfaces.
    expect(response.statusCode, 401);
    expect(session.accessToken, 'old-token');
    expect(session.isExpired, isFalse);
    expect(expiredCount, 0);
  });

  test('a failed login never triggers a refresh', () async {
    useAdapter((_) => _json(401, _unauthorized));
    session.accessToken = null;
    interceptor.refresher = () async {
      refreshCalls++;
      return true;
    };

    final response = await dio.post<dynamic>(
      '/auth/login',
      data: const {'email': 'a@b.c', 'password': 'x'},
    );

    expect(response.statusCode, 401);
    expect(refreshCalls, 0);
    expect(adapter.calls, 1);
  });

  test('a 401 with a non-session code never triggers a refresh', () async {
    useAdapter(
      (_) => _json(
        401,
        '{"success":false,"message":"Locked","code":"ACCOUNT_LOCKED"}',
      ),
    );
    session.accessToken = 'old-token';
    interceptor.refresher = () async {
      refreshCalls++;
      return true;
    };

    final response = await dio.get<dynamic>('/orders');

    expect(response.statusCode, 401);
    expect(refreshCalls, 0);
  });

  test('a 401 without a refresher wired passes straight through', () async {
    useAdapter((_) => _json(401, _unauthorized));
    session.accessToken = 'old-token';

    final response = await dio.get<dynamic>('/orders');

    expect(response.statusCode, 401);
    expect(adapter.calls, 1);
    expect(session.isExpired, isFalse);
  });
}
