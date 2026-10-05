import 'package:cuddlehug_app/core/network/api_exception.dart';
import 'package:cuddlehug_app/core/network/dio_client.dart';
import 'package:cuddlehug_app/core/network/paged.dart';
import 'package:cuddlehug_app/core/storage/auth_session.dart';
import 'package:cuddlehug_app/core/storage/secure_store.dart';
import 'package:cuddlehug_app/features/account/application/notifications_controller.dart';
import 'package:cuddlehug_app/features/account/data/models/app_notification.dart';
import 'package:cuddlehug_app/features/account/data/notification_repository.dart';
import 'package:cuddlehug_app/features/auth/application/auth_controller.dart';
import 'package:cuddlehug_app/features/auth/data/models/user.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

AppNotification _notification(String id, {bool read = false}) =>
    AppNotification(
      id: id,
      type: 'ORDER_CONFIRMATION',
      title: 'Order confirmed $id',
      body: 'We are preparing your hug.',
      read: read,
      createdAt: DateTime.utc(2026, 1, 1, 10),
    );

class _FakeNotificationRepository extends NotificationRepository {
  new()
    : super(
        DioClient(
          authSession: AuthSession(),
          secureStore: SecureStore(),
          enableLogging: false,
        ),
      );

  bool failMarkRead = false;
  final List<String> calls = [];
  final List<AppNotification> rows = [
    _notification('n1'),
    _notification('n2'),
    _notification('n3', read: true),
  ];

  @override
  Future<NotificationPage> list({int page = 1, int limit = 12}) async {
    calls.add('list:$page');
    // Two pages: items 1–2 on page 1, item 3 on page 2.
    final items = page == 1 ? rows.sublist(0, 2) : rows.sublist(2);
    return NotificationPage(
      items: items,
      meta: PaginationMeta(
        page: page,
        limit: limit,
        total: rows.length,
        totalPages: 2,
      ),
      unread: rows.where((row) => !row.read).length,
    );
  }

  @override
  Future<int> unreadCount() async => rows.where((row) => !row.read).length;

  @override
  Future<void> readAll() async {
    calls.add('readAll');
    for (var i = 0; i < rows.length; i++) {
      rows[i] = _notification(rows[i].id, read: true);
    }
  }

  @override
  Future<void> markRead(String id) async {
    if (failMarkRead) {
      throw const ApiException(
        message: 'Could not mark notification',
        code: 'BAD_REQUEST',
        status: 400,
      );
    }
    calls.add('read:$id');
    final index = rows.indexWhere((row) => row.id == id);
    rows[index] = _notification(id, read: true);
  }
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
  late _FakeNotificationRepository repo;
  late ProviderContainer container;

  setUp(() {
    repo = _FakeNotificationRepository();
    container = ProviderContainer(
      overrides: [
        authControllerProvider.overrideWith(_AuthedAuth.new),
        notificationRepositoryProvider.overrideWithValue(repo),
      ],
    );
    addTearDown(container.dispose);
  });

  NotificationsState state() => container.read(notificationsProvider);
  NotificationsController controller() =>
      container.read(notificationsProvider.notifier);

  Future<void> load() async {
    container.read(notificationsProvider);
    await Future<void>.delayed(Duration.zero);
  }

  test('loads page one with the unread badge count', () async {
    await load();
    expect(state().items, hasLength(2));
    expect(state().unread, 2);
    expect(state().hasMore, isTrue);
    expect(repo.calls, ['list:1']);
  });

  test('loadMore appends page two and flips hasMore off', () async {
    await load();
    await controller().loadMore();
    expect(state().items.map((n) => n.id), ['n1', 'n2', 'n3']);
    expect(state().hasMore, isFalse);
    expect(repo.calls, ['list:1', 'list:2']);
  });

  test(
    'markRead flips the row, decrements unread and calls the repo',
    () async {
      await load();
      await controller().markRead('n1');
      expect(state().items.first.read, isTrue);
      expect(state().unread, 1);
      expect(repo.calls, contains('read:n1'));
    },
  );

  test('markRead is a no-op for rows already read', () async {
    await load();
    await controller().loadMore();
    await controller().markRead('n3');
    expect(state().unread, 2);
    expect(repo.calls, isNot(contains('read:n3')));
  });

  test('failed markRead rethrows and reverts the row', () async {
    await load();
    repo.failMarkRead = true;
    await expectLater(
      controller().markRead('n1'),
      throwsA(isA<ApiException>()),
    );
    expect(state().items.first.read, isFalse);
    expect(state().unread, 2);
  });

  test('markAllRead marks every loaded row and zeroes the badge', () async {
    await load();
    await controller().markAllRead();
    expect(state().unread, 0);
    expect(state().items.every((n) => n.read), isTrue);
    expect(repo.calls, contains('readAll'));
  });

  test('guests get an empty inbox', () async {
    final guestContainer = ProviderContainer(
      overrides: [
        authControllerProvider.overrideWith(_GuestAuth.new),
        notificationRepositoryProvider.overrideWithValue(repo),
      ],
    );
    addTearDown(guestContainer.dispose);
    expect(guestContainer.read(notificationsProvider).items, isEmpty);
    expect(guestContainer.read(notificationsProvider).unread, 0);
  });
}
