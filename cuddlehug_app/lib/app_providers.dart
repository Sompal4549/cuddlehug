import 'package:cuddlehug_app/core/network/dio_client.dart';
import 'package:cuddlehug_app/core/routing/app_router.dart';
import 'package:cuddlehug_app/core/storage/auth_session.dart';
import 'package:cuddlehug_app/core/storage/prefs_store.dart';
import 'package:cuddlehug_app/core/storage/secure_store.dart';
import 'package:cuddlehug_app/features/auth/application/auth_controller.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// App-wide dependencies. Feature-scoped state lives next to its feature;
/// only these process-lifetime singletons are declared here.
final secureStoreProvider = Provider<SecureStore>((ref) => SecureStore());

/// Overridden in `main()` bootstrap (loaded async before `runApp`).
final prefsStoreProvider = Provider<PrefsStore>(
  (ref) => throw UnimplementedError('Override prefsStoreProvider at bootstrap'),
);

final authSessionProvider = Provider<AuthSession>((ref) => AuthSession());

final dioClientProvider = Provider<DioClient>(
  (ref) => DioClient(
    authSession: ref.watch(authSessionProvider),
    secureStore: ref.watch(secureStoreProvider),
  ),
);

/// App router with auth guards — depends on auth state lazily (redirect
/// reads it at navigation time) and re-evaluates via [routerRefreshProvider].
final routerProvider = Provider<GoRouter>((ref) {
  final router = buildAppRouter(
    isAuthenticated: () => ref.read(authControllerProvider).isAuthenticated,
    refreshListenable: ref.read(routerRefreshProvider),
  );
  ref.onDispose(router.dispose);
  return router;
});
