import 'dart:typed_data';

import 'package:cuddlehug_app/core/network/api_exception.dart';
import 'package:cuddlehug_app/core/network/dio_client.dart';
import 'package:cuddlehug_app/core/storage/auth_session.dart';
import 'package:cuddlehug_app/core/storage/prefs_store.dart';
import 'package:cuddlehug_app/core/storage/secure_store.dart';
import 'package:cuddlehug_app/features/auth/data/auth_repository.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Counts `POST /api/auth/refresh` calls so concurrent refreshes can be
/// proven to collapse into one round trip.
class _RefreshAdapter implements HttpClientAdapter {
  int refreshCalls = 0;

  /// Scripted reply — rebuilt per call because a [ResponseBody] stream can
  /// only be read once.
  int status = 200;
  String body = '{}';

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    if (options.path == '/api/auth/refresh') refreshCalls++;
    return _json(status, body);
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

const _refreshOk =
    '{"success":true,"data":{"accessToken":"rotated-access","user":'
    '{"id":"u1","email":"ada@example.com","firstName":"Ada",'
    '"lastName":"Lovelace","role":"CUSTOMER"}}}';

const _refreshRejected =
    '{"success":false,"message":"Refresh token revoked","code":"INVALID_TOKEN"}';

const _refreshDown =
    '{"success":false,"message":"Database timeout","code":"SERVER_ERROR"}';

class _FakeSecureBackend implements SecureBackend {
  new(this.data);

  final Map<String, String> data;

  @override
  Future<String?> read({required String key}) async => data[key];

  @override
  Future<void> write({required String key, required String value}) async {
    data[key] = value;
  }

  @override
  Future<void> delete({required String key}) async {
    data.remove(key);
  }

  @override
  Future<void> deleteAll() async => data.clear();
}

void main() {
  late _RefreshAdapter adapter;
  late AuthSession session;
  late SecureStore store;
  late PrefsStore prefs;
  late DioClient dio;
  late DioAuthRepository repository;

  void script(int status, String body) {
    adapter
      ..status = status
      ..body = body;
  }

  setUp(() async {
    SharedPreferences.setMockInitialValues({
      PrefsStoreTestKeys.user:
          '{"id":"u1","email":"ada@example.com",'
          '"firstName":"Ada","lastName":"Lovelace","role":"CUSTOMER"}',
    });
    adapter = _RefreshAdapter();
    session = AuthSession()..accessToken = 'stale-access';
    store = SecureStore(
      storage: _FakeSecureBackend({PrefsStoreTestKeys.refresh: 'old-refresh'}),
    );
    await store.hydrate();
    prefs = await PrefsStore.load();
    dio = DioClient(
      authSession: session,
      secureStore: store,
      enableLogging: false,
      baseUrl: 'https://api.test.local',
    );
    dio.dio.httpClientAdapter = adapter;
    repository = DioAuthRepository(
      dio: dio,
      session: session,
      store: store,
      prefs: prefs,
    );
  });

  test('concurrent refreshSilently() calls share one HTTP refresh', () async {
    script(200, _refreshOk);

    final results = await Future.wait([
      repository.refreshSilently(),
      repository.refreshSilently(),
      repository.refreshSilently(),
      repository.refreshSilently(),
      repository.refreshSilently(),
    ]);

    expect(adapter.refreshCalls, 1, reason: 'single-flight collapses 5 → 1');
    expect(results, hasLength(5));
    expect(results.every((user) => user != null), isTrue);
    expect(session.accessToken, 'rotated-access');
    expect(store.refreshToken, 'old-refresh', reason: 'no cookie → keep token');
  });

  test(
    'a second refresh after the first completes issues a new request',
    () async {
      script(200, _refreshOk);

      await repository.refreshSilently();
      await repository.refreshSilently();

      expect(adapter.refreshCalls, 2);
    },
  );

  test(
    'a revoked refresh token clears local material and returns null',
    () async {
      script(401, _refreshRejected);

      final user = await repository.refreshSilently();

      expect(user, isNull);
      expect(store.refreshToken, isNull);
      expect(prefs.readUserSnapshot(), isNull);
      expect(
        session.accessToken,
        'stale-access',
        reason: 'the caller decides when to expire the session',
      );
    },
  );

  test('a transient refresh failure throws and keeps local material', () async {
    script(503, _refreshDown);

    await expectLater(
      repository.refreshSilently(),
      throwsA(isA<ApiException>().having((e) => e.status, 'status', 503)),
    );

    expect(store.refreshToken, 'old-refresh');
    expect(prefs.readUserSnapshot(), isNotNull);
    expect(session.accessToken, 'stale-access');
  });

  test('a missing refresh token short-circuits without an HTTP call', () async {
    await store.clearRefreshToken();
    script(200, _refreshOk);

    final user = await repository.refreshSilently();

    expect(user, isNull);
    expect(adapter.refreshCalls, 0);
  });
}

/// Literal storage keys — they are private in the production store, but the
/// test seeds and inspects the backing map directly.
abstract final class PrefsStoreTestKeys {
  static const user = 'auth.user';
  static const refresh = 'ch_refresh';
}
