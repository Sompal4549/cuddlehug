import 'dart:typed_data';

import 'package:cuddlehug_app/app_providers.dart';
import 'package:cuddlehug_app/core/cache/ttl_cache.dart';
import 'package:cuddlehug_app/core/data/store_settings.dart';
import 'package:cuddlehug_app/core/network/api_exception.dart';
import 'package:cuddlehug_app/core/network/dio_client.dart';
import 'package:cuddlehug_app/core/storage/auth_session.dart';
import 'package:cuddlehug_app/core/storage/prefs_store.dart';
import 'package:cuddlehug_app/core/storage/secure_store.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _SettingsAdapter implements HttpClientAdapter {
  int calls = 0;
  int status = 200;
  String body = '{"success":true,"data":{}}';

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    calls++;
    return ResponseBody.fromString(
      body,
      status,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

class _FakeSecureBackend implements SecureBackend {
  @override
  Future<String?> read({required String key}) async => null;

  @override
  Future<void> write({required String key, required String value}) async {}

  @override
  Future<void> delete({required String key}) async {}

  @override
  Future<void> deleteAll() async {}
}

const _settingsBody =
    '{"success":true,"data":{"payment.razorpayEnabled":true,'
    '"shipping.codEnabled":false,"store.status":"open",'
    '"store.name":"CuddleHug","tax.rate":0.18}}';

const _errorBody =
    '{"success":false,"message":"Database timeout","code":"SERVER_ERROR"}';

void main() {
  late _SettingsAdapter adapter;
  late ProviderContainer container;
  late TtlCache cache;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    adapter = _SettingsAdapter();
    final dio = DioClient(
      authSession: AuthSession(),
      secureStore: SecureStore(storage: _FakeSecureBackend()),
      enableLogging: false,
      baseUrl: 'https://api.test.local',
    )..dio.httpClientAdapter = adapter;

    container = ProviderContainer(
      overrides: [
        dioClientProvider.overrideWithValue(dio),
        prefsStoreProvider.overrideWithValue(await PrefsStore.load()),
        secureStoreProvider.overrideWithValue(
          SecureStore(storage: _FakeSecureBackend()),
        ),
      ],
    );
    cache = container.read(ttlCacheProvider);
    addTearDown(container.dispose);
  });

  Future<StoreSettings> settings() =>
      container.read(storeSettingsProvider.future);

  test('a cold cache fetches once and stores the payload', () async {
    adapter.body = _settingsBody;

    final first = await settings();

    expect(adapter.calls, 1);
    expect(first.razorpayEnabled, isTrue);
    expect(first.codEnabled, isFalse);
    expect(first.storeName, 'CuddleHug');
    expect(first.taxRate, 0.18);
    expect(cache.read<Map<String, dynamic>>(storeSettingsCacheKey), isNotNull);
  });

  test('a warm cache answers without a round-trip', () async {
    adapter.body = _settingsBody;
    await settings();

    container.invalidate(storeSettingsProvider);
    final second = await settings();

    expect(adapter.calls, 1, reason: 'second read came from the cache');
    expect(second.storeName, 'CuddleHug');
  });

  test('an expired entry still answers while the network is down', () async {
    adapter.body = _settingsBody;
    final fresh = await settings();
    cache.write(storeSettingsCacheKey, fresh.raw, ttl: Duration.zero);
    container.invalidate(storeSettingsProvider);

    adapter
      ..status = 500
      ..body = _errorBody;

    final stale = await settings();

    expect(adapter.calls, 2, reason: 'the refresh was attempted');
    expect(stale.storeName, 'CuddleHug');
    expect(stale.taxRate, 0.18);
  });

  test('a cold cache with the network down surfaces the error', () async {
    adapter
      ..status = 500
      ..body = _errorBody;
    container.listen(storeSettingsProvider, (_, _) {});

    // Riverpod's `.future` only settles on a value, so the error path is
    // asserted through the provider's AsyncValue state.
    var state = container.read(storeSettingsProvider);
    for (var i = 0; i < 200 && !state.hasError; i++) {
      await Future<void>.delayed(const Duration(milliseconds: 10));
      state = container.read(storeSettingsProvider);
    }

    expect(state.hasError, isTrue);
    expect(state.error, isA<ApiException>());
    expect(adapter.calls, 1);
    expect(
      cache.read<Map<String, dynamic>>(storeSettingsCacheKey),
      isNull,
      reason: 'a failed cold start must not cache an error body',
    );
  });

  test('invalidate forces the next read to hit the network again', () async {
    adapter.body = _settingsBody;
    await settings();

    cache.invalidate(storeSettingsCacheKey);
    container.invalidate(storeSettingsProvider);
    await settings();

    expect(adapter.calls, 2);
  });
}
