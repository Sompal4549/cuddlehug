import 'package:cuddlehug_app/core/config/app_config.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Minimal in-memory TTL cache for the data layer.
///
/// Deliberately small: no eviction queues, no disk persistence, no plugin.
/// It exists so repositories/providers can answer "serve fresh data when we
/// have it, fall back to the last known copy when the network fails" without
/// pulling in a caching framework.
///
/// * **Environment isolation** — every key is prefixed with the build
///   environment, so a `dev` entry can never satisfy a `prod` read even if a
///   cache instance were ever shared.
/// * **Process scoped** — nothing is written to disk, so a restart starts
///   empty and dev/staging data cannot leak into a production install.
/// * **Log out cleanup** — call `clear` when the session ends so no data
///   outlives its owner.
@immutable
class _Entry {
  const new(this.value, this.writtenAt, this.ttl);

  final Object? value;
  final DateTime writtenAt;
  final Duration ttl;

  bool isExpired(DateTime now) => now.difference(writtenAt) >= ttl;
}

class TtlCache {
  new({String? environment, this.defaultTtl = defaultCacheTtl})
    : environment = environment ?? AppConfig.current.environment;

  /// Default TTL used when a write does not specify one (static config).
  static const defaultCacheTtl = Duration(hours: 6);

  /// Build environment that scopes every key written through this instance.
  final String environment;

  final Duration defaultTtl;

  final Map<String, _Entry> _entries = <String, _Entry>{};

  /// Scoped keys currently held (exposed for diagnostics and tests).
  Iterable<String> get keys => _entries.keys;

  int get length => _entries.length;

  String scopeOf(String key) => '$environment::$key';

  /// Returns the cached value only while it is inside its TTL.
  T? read<T>(String key) {
    final entry = _entries[scopeOf(key)];
    if (entry == null || entry.isExpired(DateTime.now())) return null;
    return _as<T>(entry.value);
  }

  /// Returns the cached value even if it has expired — used as the offline /
  /// stale fallback when a refresh fails.
  T? readStale<T>(String key) => _as<T>(_entries[scopeOf(key)]?.value);

  /// `true` when a value exists but is past its TTL.
  bool isStale(String key) {
    final entry = _entries[scopeOf(key)];
    return entry != null && entry.isExpired(DateTime.now());
  }

  bool contains(String key) => _entries.containsKey(scopeOf(key));

  void write<T>(String key, T value, {Duration? ttl}) {
    _entries[scopeOf(key)] = _Entry(value, DateTime.now(), ttl ?? defaultTtl);
  }

  void invalidate(String key) => _entries.remove(scopeOf(key));

  /// Drops every entry whose **unscoped** key satisfies [predicate].
  void invalidateWhere(bool Function(String key) predicate) {
    _entries.removeWhere((scoped, _) => predicate(_unscope(scoped)));
  }

  void clear() => _entries.clear();

  String _unscope(String scoped) {
    final separator = scoped.indexOf('::');
    return separator == -1 ? scoped : scoped.substring(separator + 2);
  }

  static T? _as<T>(Object? value) => value is T ? value : null;
}

/// Process-lifetime cache shared by the data layer.
final Provider<TtlCache> ttlCacheProvider = Provider<TtlCache>((ref) {
  final cache = TtlCache();
  ref.onDispose(cache.clear);
  return cache;
});
