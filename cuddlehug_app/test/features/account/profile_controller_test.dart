import 'package:cuddlehug_app/core/network/api_exception.dart';
import 'package:cuddlehug_app/core/network/dio_client.dart';
import 'package:cuddlehug_app/core/storage/auth_session.dart';
import 'package:cuddlehug_app/core/storage/secure_store.dart';
import 'package:cuddlehug_app/features/account/application/profile_controller.dart';
import 'package:cuddlehug_app/features/account/data/models/profile.dart';
import 'package:cuddlehug_app/features/account/data/profile_repository.dart';
import 'package:cuddlehug_app/features/auth/application/auth_controller.dart';
import 'package:cuddlehug_app/features/auth/data/models/user.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeProfileRepository extends ProfileRepository {
  new()
    : super(
        DioClient(
          authSession: AuthSession(),
          secureStore: SecureStore(),
          enableLogging: false,
        ),
      );

  bool failUpdate = false;
  bool failPassword = false;
  final List<String> calls = [];
  ProfileResponse profile = const ProfileResponse(
    user: User(
      id: 'u1',
      email: 'asha@example.com',
      firstName: 'Asha',
      lastName: 'Patel',
      role: 'CUSTOMER',
      phone: '9876543210',
      emailVerified: true,
    ),
    stats: ProfileStats(orders: 3, wishlist: 1, unreadNotifications: 2),
  );

  @override
  Future<ProfileResponse> getProfile() async => profile;

  @override
  Future<User> updateProfile({
    String? firstName,
    String? lastName,
    String? phone,
    String? avatarUrl,
  }) async {
    calls.add('update:${firstName ?? '-'}:${phone ?? '-'}');
    if (failUpdate) {
      throw const ApiException(
        message: 'Could not update your profile',
        code: 'BAD_REQUEST',
        status: 400,
      );
    }
    final updated = User(
      id: 'u1',
      email: 'asha@example.com',
      firstName: firstName ?? profile.user.firstName,
      lastName: lastName ?? profile.user.lastName,
      role: 'CUSTOMER',
      phone: phone ?? profile.user.phone,
      emailVerified: profile.user.emailVerified,
    );
    profile = ProfileResponse(user: updated, stats: profile.stats);
    return updated;
  }

  @override
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    calls.add('password:$currentPassword');
    if (failPassword) {
      throw const ApiException(
        message: 'Current password is incorrect',
        code: 'BAD_REQUEST',
        status: 400,
      );
    }
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

void main() {
  late _FakeProfileRepository repo;
  late ProviderContainer container;

  setUp(() {
    repo = _FakeProfileRepository();
    container = ProviderContainer(
      overrides: [
        authControllerProvider.overrideWith(_AuthedAuth.new),
        profileRepositoryProvider.overrideWithValue(repo),
      ],
    );
    addTearDown(container.dispose);
  });

  ProfileState state() => container.read(profileProvider);
  ProfileController controller() => container.read(profileProvider.notifier);

  test('loads the profile with counters on first read', () async {
    container.read(profileProvider);
    await Future<void>.delayed(Duration.zero);
    expect(state().user!.firstName, 'Asha');
    expect(state().profile!.stats.orders, 3);
    expect(state().profile!.stats.unreadNotifications, 2);
    expect(state().loading, isFalse);
  });

  test('update persists the new values locally', () async {
    container.read(profileProvider);
    await Future<void>.delayed(Duration.zero);
    final user = await controller().update(
      firstName: 'Ash',
      phone: '9111111111',
    );
    expect(user.firstName, 'Ash');
    expect(state().user!.firstName, 'Ash');
    expect(state().user!.phone, '9111111111');
    expect(repo.calls, ['update:Ash:9111111111']);
    expect(state().saving, isFalse);
  });

  test('failed update rethrows and keeps the old profile', () async {
    container.read(profileProvider);
    await Future<void>.delayed(Duration.zero);
    repo.failUpdate = true;
    await expectLater(
      controller().update(firstName: 'Nope'),
      throwsA(isA<ApiException>()),
    );
    expect(state().user!.firstName, 'Asha');
    expect(state().saving, isFalse);
  });

  test('changePassword surfaces the backend message', () async {
    container.read(profileProvider);
    await Future<void>.delayed(Duration.zero);
    repo.failPassword = true;
    await expectLater(
      controller().changePassword(
        currentPassword: 'wrong-pass',
        newPassword: 'newpass123',
      ),
      throwsA(
        isA<ApiException>().having(
          (e) => e.message,
          'message',
          'Current password is incorrect',
        ),
      ),
    );
    expect(repo.calls, ['password:wrong-pass']);
  });

  test('guests get an empty profile state', () async {
    final guestContainer = ProviderContainer(
      overrides: [
        authControllerProvider.overrideWith(_GuestAuth.new),
        profileRepositoryProvider.overrideWithValue(repo),
      ],
    );
    addTearDown(guestContainer.dispose);
    expect(guestContainer.read(profileProvider).user, isNull);
    expect(guestContainer.read(profileProvider).loading, isFalse);
  });
}

class _GuestAuth extends AuthController {
  @override
  AuthState build() => const AuthState.guest();
}
