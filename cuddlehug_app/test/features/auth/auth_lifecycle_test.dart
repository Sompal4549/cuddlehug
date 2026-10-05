import 'dart:async';
import 'dart:convert';

import 'package:cuddlehug_app/app_providers.dart';
import 'package:cuddlehug_app/core/cache/ttl_cache.dart';
import 'package:cuddlehug_app/core/network/api_exception.dart';
import 'package:cuddlehug_app/core/storage/auth_session.dart';
import 'package:cuddlehug_app/core/storage/prefs_store.dart';
import 'package:cuddlehug_app/core/storage/secure_store.dart';
import 'package:cuddlehug_app/features/auth/application/auth_controller.dart';
import 'package:cuddlehug_app/features/auth/data/auth_repository.dart';
import 'package:cuddlehug_app/features/auth/data/models/user.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _user = User(
  id: 'u1',
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  role: 'CUSTOMER',
);

/// Signed-looking token with a controllable `exp` claim.
String _tokenExpiringIn(Duration lifetime) {
  final claims = <String, Object>{
    'sub': 'u1',
    'exp': DateTime.now().toUtc().add(lifetime).millisecondsSinceEpoch ~/ 1000,
  };
  final payload = base64Url.encode(utf8.encode(jsonEncode(claims)));
  return 'eyJhbGciOiJIUzI1NiJ9.$payload.c2lnbmF0dXJl';
}

class _FakeAuthRepository implements AuthRepository {
  int loginCalls = 0;
  int logoutCalls = 0;
  int refreshCalls = 0;

  /// When set, [logout] parks here so concurrent calls can be observed.
  Completer<void>? logoutGate;

  /// `null` = refresh token is dead; a value = fresh session.
  User? nextRefreshUser;

  /// Non-null makes [refreshSilently] fail like an outage.
  Exception? refreshError;

  /// Non-null makes [logout] fail like an outage.
  Exception? logoutError;

  @override
  Future<User> login({required String email, required String password}) async {
    loginCalls++;
    return _user;
  }

  @override
  Future<User> register({
    required String firstName,
    required String lastName,
    required String email,
    required String password,
    String? phone,
  }) async => _user;

  @override
  Future<User?> refreshSilently() async {
    refreshCalls++;
    final error = refreshError;
    if (error != null) throw error;
    return nextRefreshUser;
  }

  @override
  Future<void> logout() async {
    logoutCalls++;
    final gate = logoutGate;
    if (gate != null) await gate.future;
    final error = logoutError;
    if (error != null) throw error;
  }

  @override
  Future<Map<String, dynamic>> forgotPassword(String email) async => const {};

  @override
  Future<void> resetPassword({
    required String token,
    required String password,
  }) async {}
}

class _FakeSecureBackend implements SecureBackend {
  final Map<String, String> data = <String, String>{};

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
  late _FakeAuthRepository repository;
  late AuthSession session;
  late ProviderContainer container;

  AuthController controller() =>
      container.read(authControllerProvider.notifier);
  AuthState state() => container.read(authControllerProvider);

  Future<void> signIn() async {
    await controller().login(email: 'ada@example.com', password: 'secret12');
    expect(state().isAuthenticated, isTrue);
  }

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    repository = _FakeAuthRepository();
    session = AuthSession();
    container = ProviderContainer(
      overrides: [
        authRepositoryProvider.overrideWithValue(repository),
        prefsStoreProvider.overrideWithValue(await PrefsStore.load()),
        secureStoreProvider.overrideWithValue(
          SecureStore(storage: _FakeSecureBackend()),
        ),
        authSessionProvider.overrideWithValue(session),
      ],
    );
    addTearDown(container.dispose);
  });

  group('logout', () {
    test('is single-flight — concurrent taps hit the server once', () async {
      final gate = Completer<void>();
      repository.logoutGate = gate;
      await signIn();

      final first = controller().logout();
      final second = controller().logout();
      final third = controller().logout();

      expect(repository.logoutCalls, 1);

      gate.complete();
      await Future.wait([first, second, third]);

      expect(repository.logoutCalls, 1);
      expect(state().status, AuthStatus.guest);
    });

    test('clears the data cache so no screen keeps the old user', () async {
      await signIn();
      container.read(ttlCacheProvider)
        ..write('cart', <String>['sku-1'])
        ..write('orders', <String>['o1']);

      await controller().logout();

      final cache = container.read(ttlCacheProvider);
      expect(cache.read<List<String>>('cart'), isNull);
      expect(cache.read<List<String>>('orders'), isNull);
    });

    test('still reaches the guest state when the server call fails', () async {
      await signIn();
      repository.logoutError = const ApiException(
        message: 'boom',
        code: 'SERVER_ERROR',
        status: 500,
      );

      // The error surfaces to the caller, but the local session is not
      // left half-signed-in.
      await expectLater(controller().logout(), throwsA(isA<ApiException>()));

      expect(state().status, AuthStatus.guest);
      expect(container.read(ttlCacheProvider).length, 0);
    });
  });

  group('markGuest', () {
    test('clears the cache and emits guest exactly once per call', () async {
      await signIn();
      container.read(ttlCacheProvider).write('cart', <String>['sku-1']);
      var routerBumps = 0;
      container.read(routerRefreshProvider).addListener(() => routerBumps++);

      controller().markGuest();

      expect(state().status, AuthStatus.guest);
      expect(
        container.read(ttlCacheProvider).read<List<String>>('cart'),
        isNull,
      );
      expect(routerBumps, 1);
    });
  });

  group('onAppResumed', () {
    test('does nothing for a guest', () async {
      await controller().onAppResumed();

      expect(repository.refreshCalls, 0);
      expect(state().isAuthenticated, isFalse);
    });

    test('leaves a long-lived token alone', () async {
      await signIn();
      session.accessToken = _tokenExpiringIn(const Duration(hours: 2));

      await controller().onAppResumed();

      expect(repository.refreshCalls, 0);
      expect(state().isAuthenticated, isTrue);
    });

    test('refreshes a token about to expire', () async {
      await signIn();
      session.accessToken = _tokenExpiringIn(const Duration(seconds: 30));
      repository.nextRefreshUser = _user;

      await controller().onAppResumed();

      expect(repository.refreshCalls, 1);
      expect(state().isAuthenticated, isTrue);
    });

    test('refreshes when the access token is missing entirely', () async {
      await signIn();
      session.accessToken = null;
      repository.nextRefreshUser = _user;

      await controller().onAppResumed();

      expect(repository.refreshCalls, 1);
      expect(state().isAuthenticated, isTrue);
    });

    test('never refreshes an already-expired session', () async {
      await signIn();
      session
        ..accessToken = _tokenExpiringIn(const Duration(seconds: 30))
        ..expire();

      await controller().onAppResumed();

      expect(repository.refreshCalls, 0);
    });

    test('a transient failure keeps the customer signed in', () async {
      await signIn();
      session.accessToken = _tokenExpiringIn(const Duration(seconds: 30));
      repository.refreshError = const ApiException(
        message: 'offline',
        code: 'NETWORK_ERROR',
      );

      await controller().onAppResumed();

      expect(repository.refreshCalls, 1);
      expect(state().isAuthenticated, isTrue);
      expect(session.isExpired, isFalse);
      expect(session.accessToken, isNotNull);
    });

    test('a dead refresh token expires the session exactly once', () async {
      var expiries = 0;
      session.onSessionExpired = () => expiries++;
      await signIn();
      session.accessToken = _tokenExpiringIn(const Duration(seconds: 30));
      repository.nextRefreshUser = null; // refresh token revoked

      await controller().onAppResumed();

      expect(state().status, AuthStatus.guest);
      expect(session.isExpired, isTrue);
      expect(expiries, 1);

      // A later resume must not fire the expiry hook again.
      await controller().onAppResumed();
      expect(expiries, 1);
    });
  });
}
