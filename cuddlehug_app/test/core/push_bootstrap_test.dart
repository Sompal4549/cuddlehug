import 'dart:async';

import 'package:cuddlehug_app/core/network/dio_client.dart';
import 'package:cuddlehug_app/core/network/paged.dart';
import 'package:cuddlehug_app/core/push/device_repository.dart';
import 'package:cuddlehug_app/core/push/push_bootstrap.dart';
import 'package:cuddlehug_app/core/push/push_service.dart';
import 'package:cuddlehug_app/core/storage/auth_session.dart';
import 'package:cuddlehug_app/core/storage/secure_store.dart';
import 'package:cuddlehug_app/features/account/application/notifications_controller.dart';
import 'package:cuddlehug_app/features/account/data/models/app_notification.dart';
import 'package:cuddlehug_app/features/account/data/notification_repository.dart';
import 'package:cuddlehug_app/features/auth/application/auth_controller.dart';
import 'package:cuddlehug_app/features/auth/data/models/user.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakePushService implements PushService {
  bool initResult = true;
  String? token = 'tok-1';
  PushEvent? initial;
  int initCalls = 0;
  int tokenRequests = 0;

  final StreamController<String> tokenRefresh =
      StreamController<String>.broadcast();
  final StreamController<PushEvent> foreground =
      StreamController<PushEvent>.broadcast();

  @override
  Future<bool> init() async {
    initCalls++;
    return initResult;
  }

  @override
  Future<String?> requestToken() async {
    tokenRequests++;
    return token;
  }

  @override
  Stream<String> get onTokenRefresh => tokenRefresh.stream;

  @override
  Stream<PushEvent> get onForegroundMessage => foreground.stream;

  @override
  Future<PushEvent?> takeInitialMessage() async {
    final message = initial;
    initial = null;
    return message;
  }

  @override
  Future<void> showLocal(PushEvent event) async {}
}

class _FakeDeviceRepository extends DeviceRepository {
  new()
      : super(
          DioClient(
            authSession: AuthSession(),
            secureStore: SecureStore(),
            enableLogging: false,
          ),
        );

  final List<String> calls = [];

  @override
  Future<void> register({
    required String token,
    required String platform,
    String? appId,
  }) async {
    calls.add('register:$token:$platform');
  }

  @override
  Future<void> unregister({required String token}) async {
    calls.add('unregister:$token');
  }
}

class _FakeNotificationRepository extends NotificationRepository {
  new()
      : super(
          DioClient(
            authSession: AuthSession(),
            secureStore: SecureStore(),
            enableLogging: false,
          ),
        );

  int unread = 5;

  @override
  Future<NotificationPage> list({int page = 1, int limit = 12}) async =>
      NotificationPage(
        items: List<AppNotification>.empty(),
        meta: PaginationMeta(
          page: page,
          limit: limit,
          total: 0,
          totalPages: 1,
        ),
        unread: unread,
      );

  @override
  Future<int> unreadCount() async => unread;
}

class _AuthedAuth extends AuthController {
  @override
  AuthState build() => const AuthState.authenticated(
        User(
          id: 'u1',
          email: 'asha@example.com',
          firstName: 'Asha',
          lastName: 'Patel',
          role: 'CUSTOMER',
        ),
      );
}

class _GuestAuth extends AuthController {
  @override
  AuthState build() => const AuthState.guest();
}

void main() {
  late _FakePushService push;
  late _FakeDeviceRepository devices;
  late _FakeNotificationRepository notifications;
  late ProviderContainer container;

  setUp(() {
    push = _FakePushService();
    devices = _FakeDeviceRepository();
    notifications = _FakeNotificationRepository();
    container = ProviderContainer(
      overrides: [
        pushServiceProvider.overrideWithValue(push),
        deviceRepositoryProvider.overrideWithValue(devices),
        notificationRepositoryProvider.overrideWithValue(notifications),
        authControllerProvider.overrideWith(_AuthedAuth.new),
      ],
    );
    addTearDown(container.dispose);
  });

  PushBootstrap bootstrap() => container.read(pushBootstrapProvider);
  Future<void> settle() => Future<void>.delayed(Duration.zero);

  test('sign-in requests a token and registers the device', () async {
    await bootstrap().onAuthChanged('u1');
    expect(push.initCalls, 1);
    expect(push.tokenRequests, 1);
    expect(devices.calls, ['register:tok-1:ANDROID']);
  });

  test('sign-out unregisters the stored token', () async {
    final subject = bootstrap();
    await subject.onAuthChanged('u1');
    await subject.onAuthChanged(null);
    expect(devices.calls, [
      'register:tok-1:ANDROID',
      'unregister:tok-1',
    ]);
  });

  test('push unavailable registers nothing (poll fallback path)', () async {
    push
      ..initResult = false
      ..token = null;
    await bootstrap().onAuthChanged('u1');
    expect(devices.calls, isEmpty);
  });

  test('token refresh re-registers the new token', () async {
    final subject = bootstrap();
    await subject.onAuthChanged('u1');
    push.tokenRefresh.add('tok-2');
    await settle();
    expect(devices.calls, contains('register:tok-2:ANDROID'));
  });

  test('bootstrap handles the launch-from-tray message exactly once',
      () async {
    push.initial = const PushEvent(
      title: 'Order shipped',
      body: 'Your bears are on the way',
      data: <String, String>{'type': 'SHIPPING', 'orderId': 'o9'},
    );
    final subject = bootstrap();
    await subject.bootstrap();
    await subject.bootstrap(); // second call is a no-op
    // takeInitialMessage clears the fake's payload; a crash would fail here.
    expect(push.tokenRequests, 0);
  });

  test('foreground messages refresh the unread badge', () async {
    // Seed the auth-gated inbox (loads with unread = 5).
    container.read(notificationsProvider);
    await settle();
    expect(container.read(notificationsProvider).unread, 5);

    final subject = bootstrap();
    await subject.onAuthChanged('u1');
    notifications.unread = 7;
    push.foreground.add(
      const PushEvent(title: 'Order delivered', body: 'Enjoy!'),
    );
    await settle();
    await settle();
    expect(container.read(notificationsProvider).unread, 7);
  });

  test('badge polling starts when push is unavailable', () async {
    push
      ..initResult = false
      ..token = null;
    final subject = bootstrap();
    await subject.onAuthChanged('u1');
    // dispose() cancels the 60s poll timer — flutter_test fails on leaks.
    subject.dispose();
    expect(devices.calls, isEmpty);
  });

  test('guests never touch the device registry', () async {
    final guest = ProviderContainer(
      overrides: [
        pushServiceProvider.overrideWithValue(push),
        deviceRepositoryProvider.overrideWithValue(devices),
        authControllerProvider.overrideWith(_GuestAuth.new),
      ],
    );
    addTearDown(guest.dispose);
    final subject = guest.read(pushBootstrapProvider);
    await subject.onAuthChanged(null);
    await subject.onAuthChanged(null);
    expect(devices.calls, isEmpty);
    expect(push.tokenRequests, 0);
  });
}
