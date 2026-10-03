import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// One push event — foreground FCM message or a tap on a tray notification.
@immutable
class PushEvent {
  const new({
    required this.title,
    required this.body,
    this.data = const <String, String>{},
  });

  final String title;
  final String body;
  final Map<String, String> data;
}

/// Abstraction over FCM + local notifications so registration logic is
/// testable without platform channels (and so the app degrades gracefully
/// when Firebase is not configured yet).
abstract interface class PushService {
  /// Firebase + local-notification setup. Returns false when unavailable
  /// (no Firebase project configured, platform unsupported, etc.).
  Future<bool> init();

  /// Notification permission + the current FCM token (null when push is
  /// unavailable or the user denies).
  Future<String?> requestToken();

  /// Stream of replacement FCM tokens (fires after refresh/rotation).
  Stream<String> get onTokenRefresh;

  /// Messages that arrive while the app is in the foreground.
  Stream<PushEvent> get onForegroundMessage;

  /// The message the app was launched from (null for normal launches).
  Future<PushEvent?> takeInitialMessage();

  /// Display a foreground message through the system (local) notification.
  Future<void> showLocal(PushEvent event);
}

/// Production implementation: FCM for delivery, flutter_local_notifications
/// for foreground display.
class FcmPushService implements PushService {
  // Lazy: FirebaseMessaging.instance throws when no Firebase app exists yet
  // (tests, or before `flutterfire configure` has provisioned the project).
  FirebaseMessaging get _messaging => FirebaseMessaging.instance;

  final FlutterLocalNotificationsPlugin _local =
      FlutterLocalNotificationsPlugin();

  static const _channel = AndroidNotificationChannel(
    'cuddlehug_general',
    'Order updates',
    description: 'Order, payment and delivery alerts',
    importance: Importance.high,
  );

  final StreamController<String> _tokenRefresh =
      StreamController<String>.broadcast();
  final StreamController<PushEvent> _foreground =
      StreamController<PushEvent>.broadcast();

  var _initialized = false;
  var _wired = false;
  Future<bool>? _initFuture;
  PushEvent? _initialMessage;
  var _initialTaken = false;

  @override
  Future<bool> init() => _initFuture ??= _doInit();

  Future<bool> _doInit() async {
    if (_initialized) return true;
    try {
      // Tolerates a missing google-services.json on Android (throws) so the
      // app still runs before the Firebase project is provisioned.
      await Firebase.initializeApp();
      await _local.initialize(
        settings: const InitializationSettings(
          android: AndroidInitializationSettings('@mipmap/ic_launcher'),
          iOS: DarwinInitializationSettings(),
        ),
      );
      await _local
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(_channel);
      _wireMessaging();
      _initialized = true;
      return true;
    } on Object catch (e) {
      debugPrint('Push disabled — Firebase unavailable: $e');
      return false;
    }
  }

  void _wireMessaging() {
    if (_wired) return;
    _wired = true;
    FirebaseMessaging.onMessage.listen((message) {
      final event = _toEvent(message);
      _foreground.add(event);
      // Also surface through the OS tray while foregrounded (FCM's default
      // tray behaviour only applies in background/terminated states).
      unawaited(showLocal(event));
    });
    _messaging.onTokenRefresh.listen(_tokenRefresh.add);
    unawaited(
      _messaging.getInitialMessage().then((message) {
        if (message != null) _initialMessage = _toEvent(message);
      }),
    );
  }

  PushEvent _toEvent(RemoteMessage message) => PushEvent(
        title: message.notification?.title ?? 'CuddleHug',
        body: message.notification?.body ?? '',
        data: message.data.map((key, value) => MapEntry(key, '$value')),
      );

  @override
  Future<String?> requestToken() async {
    if (!_initialized) return null;
    try {
      // On Android this triggers the POST_NOTIFICATIONS runtime prompt on
      // API 33+; on iOS it is the standard permission dialog.
      await _messaging.requestPermission();
      final token = await _messaging.getToken();
      return token;
    } on Object catch (e) {
      debugPrint('Push token unavailable: $e');
      return null;
    }
  }

  @override
  Stream<String> get onTokenRefresh => _tokenRefresh.stream;

  @override
  Stream<PushEvent> get onForegroundMessage => _foreground.stream;

  @override
  Future<PushEvent?> takeInitialMessage() async {
    if (_initialTaken) return null;
    _initialTaken = true;
    return _initialMessage;
  }

  @override
  Future<void> showLocal(PushEvent event) async {
    if (!_initialized) return;
    await _local.show(
      id: event.title.hashCode & 0x7fffffff,
      title: event.title,
      body: event.body,
      notificationDetails: NotificationDetails(
        android: AndroidNotificationDetails(
          _channel.id,
          _channel.name,
          channelDescription: _channel.description,
          importance: Importance.high,
          priority: Priority.high,
        ),
        iOS: const DarwinNotificationDetails(),
      ),
      payload: event.data.isEmpty ? null : Uri(queryParameters: event.data).query,
    );
  }
}
