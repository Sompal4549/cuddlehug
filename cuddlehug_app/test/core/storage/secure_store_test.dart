import 'package:cuddlehug_app/core/storage/secure_store.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  // In-memory fake — the platform channel isn't available in tests.
  late Map<String, String> backing;

  SecureStore newStore() => SecureStore(storage: _FakeBackend(backing));

  setUp(() => backing = {});

  test('hydrate mints a server-valid guest session id on first run', () async {
    final store = newStore();
    await store.hydrate();

    expect(store.sessionId, isNotNull);
    expect(RegExp(r'^[a-f0-9-]{36}$').hasMatch(store.sessionId!), isTrue);
    // Shape: 8-4-4-4-12 with version 4 and RFC variant bits.
    expect(
      RegExp(
        r'^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$',
      ).hasMatch(store.sessionId!),
      isTrue,
    );
    expect(backing['ch_sid'], store.sessionId);
  });

  test('hydrate reuses the persisted session id (stable guest cart)', () async {
    final first = newStore();
    await first.hydrate();
    final minted = first.sessionId;

    final second = newStore();
    await second.hydrate();

    expect(second.sessionId, minted);
  });

  test('mints a different id per fresh install', () async {
    final a = newStore();
    await a.hydrate();
    final idA = a.sessionId;

    backing = {};
    final b = newStore();
    await b.hydrate();

    expect(b.sessionId, isNot(idA));
  });

  test('clearAll wipes the session id', () async {
    final store = newStore();
    await store.hydrate();
    await store.clearAll();

    expect(store.sessionId, isNull);
    expect(backing, isEmpty);
  });
}

class _FakeBackend implements SecureBackend {
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
