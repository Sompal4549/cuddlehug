import 'package:cuddlehug_app/core/cache/ttl_cache.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  late TtlCache cache;

  setUp(() => cache = TtlCache(environment: 'prod'));

  test('scopes every key with the build environment', () {
    cache.write('cart', <String>['sku-1']);

    expect(cache.scopeOf('cart'), 'prod::cart');
    expect(cache.keys, ['prod::cart']);
    expect(cache.contains('cart'), isTrue);
    expect(cache.length, 1);
  });

  test('returns a fresh value inside its TTL', () {
    cache.write('home', {'title': 'Hi'});

    expect(cache.read<Map<String, dynamic>>('home'), {'title': 'Hi'});
    expect(cache.isStale('home'), isFalse);
  });

  test('an expired value is invisible to read but visible to readStale', () {
    cache.write('home', 'old', ttl: Duration.zero);

    expect(cache.read<String>('home'), isNull);
    expect(cache.isStale('home'), isTrue);
    expect(cache.readStale<String>('home'), 'old');
  });

  test('read returns null for an unknown key', () {
    expect(cache.read<String>('nope'), isNull);
    expect(cache.readStale<String>('nope'), isNull);
    expect(cache.isStale('nope'), isFalse);
    expect(cache.contains('nope'), isFalse);
  });

  test('a value of the wrong type reads as null instead of throwing', () {
    cache.write('count', 7);

    expect(cache.read<String>('count'), isNull);
    expect(cache.read<int>('count'), 7);
  });

  test('invalidate drops only the matching key', () {
    cache
      ..write('a', 1)
      ..write('b', 2)
      ..invalidate('a');

    expect(cache.contains('a'), isFalse);
    expect(cache.contains('b'), isTrue);
  });

  test('invalidateWhere matches on the unscoped key', () {
    cache
      ..write('cart.line', 1)
      ..write('cart.totals', 2)
      ..write('home', 3)
      ..invalidateWhere((key) => key.startsWith('cart.'));

    expect(cache.contains('cart.line'), isFalse);
    expect(cache.contains('cart.totals'), isFalse);
    expect(cache.contains('home'), isTrue);
  });

  test('clear empties the cache for logout', () {
    cache
      ..write('a', 1)
      ..write('b', 2)
      ..clear();

    expect(cache.length, 0);
    expect(cache.read<int>('a'), isNull);
  });

  test('distinct instances isolate their entries per environment', () {
    final dev = TtlCache(environment: 'dev')..write('home', 'dev-data');
    final prod = TtlCache(environment: 'prod')..write('home', 'prod-data');

    expect(dev.scopeOf('home'), 'dev::home');
    expect(prod.scopeOf('home'), 'prod::home');
    expect(dev.read<String>('home'), 'dev-data');
    expect(prod.read<String>('home'), 'prod-data');
  });
}
