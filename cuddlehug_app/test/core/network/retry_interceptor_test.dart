import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:cuddlehug_app/core/network/interceptors/retry_interceptor.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

/// One scripted outcome per call: an HTTP status, or a transport failure.
typedef _Outcome = Object;

class _ScriptedAdapter implements HttpClientAdapter {
  new(this.script);

  /// e.g. `[500, 200, const SocketException('down')]`.
  final List<_Outcome> script;

  /// `script.length` scripted outcomes are replayed; the last one repeats
  /// forever so an accidental retry loop fails the `calls` assertions, not
  /// hangs.
  int calls = 0;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final outcome = script[calls < script.length ? calls : script.length - 1];
    calls++;
    if (outcome is Exception) throw outcome;
    return ResponseBody.fromString(
      '{"success":true,"data":{}}',
      outcome as int,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  late _ScriptedAdapter adapter;
  late Dio dio;

  /// Zero backoff so the suite stays fast; the schedule itself is asserted
  /// by the budget (`delays.length` retries), not by wall-clock timing.
  RetryInterceptor newRetry() =>
      RetryInterceptor(client: dio, delays: const [Duration.zero, Duration.zero]);

  setUp(() {
    dio = Dio(
      BaseOptions(
        baseUrl: 'http://test.local',
        // Mirrors `DioClient` — 5xx stays a *response* so the envelope can
        // surface a server error code instead of a generic network failure.
        validateStatus: (status) => status != null && status < 600,
      ),
    );
  });

  void useAdapter(List<_Outcome> script) {
    adapter = _ScriptedAdapter(script);
    dio.httpClientAdapter = adapter;
    dio.interceptors.add(newRetry());
  }

  test('GET retries a 5xx up to 2 times and returns the first success', () async {
    useAdapter([500, 500, 200]);

    final response = await dio.get<dynamic>('/content/home');

    expect(response.statusCode, 200);
    expect(adapter.calls, 3);
  });

  test('GET stops after 2 retries and surfaces the final 5xx', () async {
    useAdapter([500]);

    final response = await dio.get<dynamic>('/content/home');

    expect(response.statusCode, 500);
    expect(adapter.calls, 3);
  });

  test('GET retries transient transport failures', () async {
    useAdapter([const SocketException('no route'), 200]);

    final response = await dio.get<dynamic>('/content/home');

    expect(response.statusCode, 200);
    expect(adapter.calls, 2);
  });

  test('GET gives up when every attempt fails at the transport layer', () async {
    useAdapter([const SocketException('no route')]);

    await expectLater(
      dio.get<dynamic>('/content/home'),
      throwsA(
        isA<DioException>().having(
          (e) => e.type,
          'type',
          DioExceptionType.unknown,
        ),
      ),
    );
    expect(adapter.calls, 3);
  });

  test('mutations are never auto-retried', () async {
    useAdapter([500, 200]);

    final response = await dio.post<dynamic>('/cart/items', data: const {});

    // Exactly one attempt — a retried POST could double-submit an order.
    expect(response.statusCode, 500);
    expect(adapter.calls, 1);
  });

  test('mutating transport failures are never auto-retried', () async {
    useAdapter([const SocketException('no route')]);

    await expectLater(
      dio.post<dynamic>('/payments/verify', data: const {}),
      throwsA(isA<DioException>()),
    );
    expect(adapter.calls, 1);
  });

  test('a 4xx is passed through untouched (no retry, no error)', () async {
    useAdapter([404, 200]);

    final response = await dio.get<dynamic>('/products/nope');

    expect(response.statusCode, 404);
    expect(adapter.calls, 1);
  });

  test('cancellations are not retried', () async {
    useAdapter([200]);
    final cancelToken = CancelToken();

    final pending = dio.get<dynamic>('/content/home', cancelToken: cancelToken);
    cancelToken.cancel('user navigated away');

    await expectLater(pending, throwsA(isA<DioException>()));
    expect(adapter.calls, 0);
  });
}
