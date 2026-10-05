import 'dart:math';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Key/value primitives [SecureStore] needs — lets tests swap in an in-memory
/// map (the platform channel isn't available under `flutter test`).
abstract interface class SecureBackend {
  Future<String?> read({required String key});

  Future<void> write({required String key, required String value});

  Future<void> delete({required String key});

  Future<void> deleteAll();
}

/// Real backend: Keychain on iOS, EncryptedSharedPreferences on Android.
class FlutterSecureBackend implements SecureBackend {
  const new([this._storage = const FlutterSecureStorage()]);

  final FlutterSecureStorage _storage;

  @override
  Future<String?> read({required String key}) => _storage.read(key: key);

  @override
  Future<void> write({required String key, required String value}) =>
      _storage.write(key: key, value: value);

  @override
  Future<void> delete({required String key}) => _storage.delete(key: key);

  @override
  Future<void> deleteAll() => _storage.deleteAll();
}

/// Encrypted storage for the refresh token and guest cart session id
/// (plan §5.2).
class SecureStore {
  new({SecureBackend? storage})
    : _storage = storage ?? const FlutterSecureBackend();

  static const _refreshTokenKey = 'ch_refresh';
  static const _sessionIdKey = 'ch_sid';

  final SecureBackend _storage;
  final Random _random = Random.secure();

  /// Cached copies so interceptors can read synchronously per request.
  String? refreshToken;
  String? sessionId;

  /// Loads persisted values into memory — call once during bootstrap.
  ///
  /// Also mints the guest cart session on first run (plan §6.1): the server
  /// accepts any `/^[a-f0-9-]{36}$/` id, and generating client-side keeps one
  /// stable cart across requests instead of a fresh one per call.
  Future<void> hydrate() async {
    refreshToken = await _storage.read(key: _refreshTokenKey);
    sessionId = await _storage.read(key: _sessionIdKey);
    if (sessionId == null || sessionId!.isEmpty) {
      await writeSessionId(_newSessionId());
    }
  }

  /// RFC-4122 v4 shaped UUID (server validates format only).
  String _newSessionId() {
    String hex(int count) => List.generate(
      count,
      (_) => _random.nextInt(16).toRadixString(16),
    ).join();
    // 13th char = 4 (version), 17th char ∈ {8,9,a,b} (variant).
    const variants = ['8', '9', 'a', 'b'];
    return '${hex(8)}-${hex(4)}-4${hex(3)}-'
        '${variants[_random.nextInt(4)]}${hex(3)}-${hex(12)}';
  }

  Future<void> writeRefreshToken(String value) async {
    refreshToken = value;
    await _storage.write(key: _refreshTokenKey, value: value);
  }

  Future<void> writeSessionId(String value) async {
    sessionId = value;
    await _storage.write(key: _sessionIdKey, value: value);
  }

  Future<void> clearRefreshToken() async {
    refreshToken = null;
    await _storage.delete(key: _refreshTokenKey);
  }

  Future<void> clearAll() async {
    refreshToken = null;
    sessionId = null;
    await _storage.deleteAll();
  }
}
