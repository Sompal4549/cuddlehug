import 'dart:async';

import 'package:cuddlehug_app/app_providers.dart';
import 'package:cuddlehug_app/core/utils/jwt.dart';
import 'package:cuddlehug_app/features/auth/data/auth_repository.dart';
import 'package:cuddlehug_app/features/auth/data/models/user.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

enum AuthStatus { restoring, guest, authenticated }

@immutable
class AuthState {
  const new({required this.status, this.user, this.cachedUser});

  const new guest() : this(status: AuthStatus.guest);

  const new authenticated(User user)
      : this(status: AuthStatus.authenticated, user: user);

  final AuthStatus status;

  /// Fresh user from the last successful login/refresh.
  final User? user;

  /// Snapshot from prefs shown while a cold-start refresh is in flight.
  final User? cachedUser;

  bool get isAuthenticated => status == AuthStatus.authenticated;
  User? get displayUser => user ?? cachedUser;
}

/// Owns the UI-facing session state (plan §5).
class AuthController extends Notifier<AuthState> {
  Timer? _proactiveTimer;

  @override
  AuthState build() {
    final session = ref.read(authSessionProvider)
      ..onAccessTokenSet = _scheduleProactiveRefresh;
    ref.onDispose(() {
      session.onAccessTokenSet = null;
      _proactiveTimer?.cancel();
    });
    return const AuthState(status: AuthStatus.restoring);
  }

  /// Cold start: silently restore the session from secure storage (plan §5.4).
  Future<void> restoreSession() async {
    final store = ref.read(secureStoreProvider);
    if (store.refreshToken == null) {
      _emit(const AuthState.guest());
      return;
    }
    final prefs = ref.read(prefsStoreProvider);
    final cached = prefs.readUserSnapshot();
    if (cached != null) {
      _emit(AuthState(status: AuthStatus.restoring, cachedUser: User.fromJson(cached)));
    }
    try {
      final user = await ref.read(authRepositoryProvider).refreshSilently();
      _emit(user != null ? AuthState.authenticated(user) : const AuthState.guest());
    } on Object {
      // Transient failure — show guest; the token survives for next launch.
      _emit(const AuthState.guest());
    }
  }

  Future<void> login({required String email, required String password}) async {
    final user = await ref
        .read(authRepositoryProvider)
        .login(email: email, password: password);
    _emit(AuthState.authenticated(user));
  }

  Future<void> register({
    required String firstName,
    required String lastName,
    required String email,
    required String password,
    String? phone,
  }) async {
    final user = await ref.read(authRepositoryProvider).register(
          firstName: firstName,
          lastName: lastName,
          email: email,
          password: password,
          phone: phone,
        );
    _emit(AuthState.authenticated(user));
  }

  Future<void> logout() async {
    await ref.read(authRepositoryProvider).logout();
    _proactiveTimer?.cancel();
    _emit(const AuthState.guest());
  }

  Future<Map<String, dynamic>> forgotPassword(String email) =>
      ref.read(authRepositoryProvider).forgotPassword(email);

  Future<void> resetPassword({required String token, required String password}) =>
      ref.read(authRepositoryProvider).resetPassword(token: token, password: password);

  /// Called by the session-expiry hook (interceptor path) — local logout goes
  /// through [logout] instead and never hits this.
  void markGuest() {
    _proactiveTimer?.cancel();
    _emit(const AuthState.guest());
  }

  void _emit(AuthState next) {
    state = next;
    // Let GoRouter re-evaluate guards (e.g. session expired on /account).
    ref.read(routerRefreshProvider).value++;
  }

  /// Refresh ~60s before `exp` so most requests never see a 401 (plan §5.3).
  void _scheduleProactiveRefresh(String accessToken) {
    _proactiveTimer?.cancel();
    final expiry = accessTokenExpiry(accessToken);
    if (expiry == null) return;
    final delay = expiry.difference(DateTime.now().toUtc()) - const Duration(seconds: 60);
    if (delay < const Duration(seconds: 5)) return;
    _proactiveTimer = Timer(delay, () {
      // Best-effort: a failure here surfaces via the normal 401 path.
      unawaited(
        ref.read(authRepositoryProvider).refreshSilently().catchError((Object _) => null),
      );
    });
  }
}

final authControllerProvider =
    NotifierProvider<AuthController, AuthState>(AuthController.new);

/// Bumped whenever [AuthState] changes so GoRouter re-runs its redirect
/// (guards must react to login/logout/session-expiry without navigation).
final Provider<ValueNotifier<int>> routerRefreshProvider = Provider<ValueNotifier<int>>(
  (ref) => ValueNotifier<int>(0),
);
