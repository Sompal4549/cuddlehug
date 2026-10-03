import 'dart:async';

import 'package:cuddlehug_app/app_providers.dart';
import 'package:cuddlehug_app/core/push/push_bootstrap.dart';
import 'package:cuddlehug_app/core/storage/auth_session.dart';
import 'package:cuddlehug_app/core/theme/app_theme.dart';
import 'package:cuddlehug_app/core/widgets/offline_banner.dart';
import 'package:cuddlehug_app/features/auth/application/auth_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Global messenger for non-context UI messages (session expiry, …).
final scaffoldMessengerKey = GlobalKey<ScaffoldMessengerState>();

class CuddleHugApp extends ConsumerStatefulWidget {
  const new({super.key});

  @override
  ConsumerState<CuddleHugApp> createState() => _CuddleHugAppState();
}

class _CuddleHugAppState extends ConsumerState<CuddleHugApp> {
  late final GoRouter _router = ref.read(routerProvider);
  late final AuthSession _session = ref.read(authSessionProvider);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _wireSessionHooks();
      _wirePush();
    });
  }

  void _wirePush() {
    // Push bootstrap: FCM init + launch-from-tray deep link, then register /
    // unregister the device token on every auth change (plan §9.4).
    unawaited(ref.read(pushBootstrapProvider).bootstrap());
    ref.listenManual<String?>(
      authControllerProvider.select((state) => state.user?.id),
      (_, userId) =>
          unawaited(ref.read(pushBootstrapProvider).onAuthChanged(userId)),
      fireImmediately: true,
    );
  }

  void _wireSessionHooks() {
    _session.onSessionExpired = () {
      // Guard redirect (via routerRefreshProvider) routes away from protected
      // screens; we only update state and explain what happened.
      ref.read(authControllerProvider.notifier).markGuest();
      scaffoldMessengerKey.currentState?.showSnackBar(
        const SnackBar(content: Text('Session expired — please sign in again.')),
      );
    };
  }

  @override
  void dispose() {
    // Saved in a field: `ref` is unsafe during dispose (plan §5 wiring).
    _session.onSessionExpired = null;
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => MaterialApp.router(
        title: 'CuddleHug',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light,
        routerConfig: _router,
        scaffoldMessengerKey: scaffoldMessengerKey,
        // Plan §10.1: persistent offline banner above every screen.
        builder: (context, child) => OfflineBanner(child: child ?? const SizedBox()),
      );
}
