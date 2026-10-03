import 'dart:async';
import 'dart:io' show Platform;

import 'package:cuddlehug_app/app_providers.dart';
import 'package:cuddlehug_app/core/push/device_repository.dart';
import 'package:cuddlehug_app/core/push/push_link.dart';
import 'package:cuddlehug_app/core/push/push_service.dart';
import 'package:cuddlehug_app/features/account/application/notifications_controller.dart';
import 'package:cuddlehug_app/features/auth/application/auth_controller.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final pushServiceProvider = Provider<PushService>((ref) => FcmPushService());

final pushBootstrapProvider = Provider<PushBootstrap>((ref) {
  final push = PushBootstrap(ref);
  ref.onDispose(push.dispose);
  return push;
});

/// Push lifecycle (plan §9.4):
///
/// * app start → [bootstrap]: init FCM + local notifications, handle a
///   launch-from-tray deep link;
/// * sign-in → permission + token → `POST /api/devices/register`;
/// * sign-out → `POST /api/devices/unregister`;
/// * while push is unavailable (Firebase not provisioned yet) or permission
///   is denied → poll `unread-count` every 60s so the badge still works.
class PushBootstrap {
  new(this.ref, {this._service, String? platform})
      : _platform = platform ?? _defaultPlatform();

  final Ref ref;
  final PushService? _service;
  final String _platform;

  PushService get service => _service ?? ref.read(pushServiceProvider);

  String? _registeredToken;
  bool? _pushReady;
  bool _wired = false;
  bool _launchHandled = false;
  bool _disposed = false;
  Timer? _poll;

  static String _defaultPlatform() =>
      Platform.isIOS ? 'IOS' : 'ANDROID';

  /// One-time app-start work — call from the app shell after the first frame.
  Future<void> bootstrap() async {
    await _ensureInit();
    await handleLaunchMessage();
  }

  /// Routes the notification the app was launched from (guarded — an
  /// unauthenticated customer lands on /login?next=… via the router).
  Future<void> handleLaunchMessage() async {
    if (_launchHandled) return;
    _launchHandled = true;
    final message = await service.takeInitialMessage();
    if (message == null) return;
    ref.read(routerProvider).go(pushRouteFor(message.data));
  }

  /// Reacts to sign-in / sign-out (call with the current user id, and on
  /// every subsequent auth change).
  Future<void> onAuthChanged(String? userId) async {
    if (userId == null) {
      await _disable();
    } else {
      await _enable(userId);
    }
  }

  Future<bool> _ensureInit() async {
    final ready = _pushReady ??= await service.init();
    if (ready) _wireStreams();
    return ready;
  }

  void _wireStreams() {
    if (_wired) return;
    _wired = true;
    service.onTokenRefresh.listen((token) {
      final registered = _registeredToken;
      if (registered == null || token == registered) return;
      unawaited(_register(token));
    });
    service.onForegroundMessage.listen((_) {
      // The service already displayed it locally; refresh the badge count.
      unawaited(_syncBadge());
    });
  }

  Future<void> _enable(String userId) async {
    final ready = await _ensureInit();
    if (_disposed) return;
    final token = await service.requestToken();
    if (_disposed) return;
    if (token != null && token.isNotEmpty) {
      await _register(token);
      _stopPolling();
      return;
    }
    // Push unavailable or permission denied — fall back to polling so the
    // in-app badge and notification centre still work.
    if (!ready || token == null || token.isEmpty) _startPolling();
  }

  Future<void> _register(String token) async {
    _registeredToken = token;
    try {
      await ref
          .read(deviceRepositoryProvider)
          .register(token: token, platform: _platform);
    } on Exception catch (e) {
      // Best-effort — the next launch or token refresh retries.
      debugPrint('Device registration failed: $e');
    }
  }

  Future<void> _disable() async {
    _stopPolling();
    final token = _registeredToken;
    _registeredToken = null;
    if (token == null) return;
    try {
      await ref.read(deviceRepositoryProvider).unregister(token: token);
    } on Exception catch (e) {
      debugPrint('Device unregistration failed: $e');
    }
  }

  void _startPolling() {
    if (_disposed) return;
    _poll ??= Timer.periodic(
      const Duration(seconds: 60),
      (_) => unawaited(_syncBadge()),
    );
  }

  void _stopPolling() {
    _poll?.cancel();
    _poll = null;
  }

  Future<void> _syncBadge() async {
    if (!ref.read(authControllerProvider).isAuthenticated) return;
    await ref.read(notificationsProvider.notifier).syncUnread();
  }

  /// Cancels timers/subscriptions (used on container dispose in tests).
  void dispose() {
    _disposed = true;
    _stopPolling();
  }
}
