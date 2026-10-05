import 'package:cuddlehug_app/core/routing/app_router.dart';
import 'package:cuddlehug_app/core/routing/route_paths.dart';
import 'package:cuddlehug_app/features/auth/data/auth_repository.dart';
import 'package:cuddlehug_app/features/auth/data/models/user.dart';
import 'package:cuddlehug_app/features/auth/presentation/login_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

const _user = User(
  id: 'u1',
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  role: 'CUSTOMER',
);

class _FakeAuthRepository implements AuthRepository {
  @override
  Future<User> login({required String email, required String password}) async =>
      _user;

  @override
  Future<User> register({
    required String firstName,
    required String lastName,
    required String email,
    required String password,
    String? phone,
  }) async => _user;

  @override
  Future<User?> refreshSilently() async => null;

  @override
  Future<void> logout() async {}

  @override
  Future<Map<String, dynamic>> forgotPassword(String email) async => const {};

  @override
  Future<void> resetPassword({
    required String token,
    required String password,
  }) async {}
}

Future<GoRouter> _pump(
  WidgetTester tester, {
  required bool authenticated,
}) async {
  tester.view.devicePixelRatio = 1.0;
  tester.view.physicalSize = const Size(400, 900);
  addTearDown(tester.view.reset);

  late GoRouter router;
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authRepositoryProvider.overrideWithValue(_FakeAuthRepository()),
      ],
      child: MaterialApp.router(
        routerConfig: router = buildAppRouter(
          initialLocation: '/',
          isAuthenticated: () => authenticated,
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return router;
}

void main() {
  group('safeRedirectTarget', () {
    test('accepts an in-app absolute path', () {
      expect(safeRedirectTarget('/orders'), '/orders');
      expect(
        safeRedirectTarget('/product/red-bear?ref=push'),
        '/product/red-bear?ref=push',
      );
    });

    test('rejects null, empty and relative targets', () {
      expect(safeRedirectTarget(null), isNull);
      expect(safeRedirectTarget(''), isNull);
      expect(safeRedirectTarget('orders'), isNull);
      expect(safeRedirectTarget('https://evil.example.com'), isNull);
    });

    test('rejects scheme-relative URLs that would leave the app origin', () {
      expect(safeRedirectTarget('//evil.example.com'), isNull);
      expect(safeRedirectTarget('///evil.example.com'), isNull);
    });

    test('rejects backslash and encoded-slash smuggling', () {
      expect(
        safeRedirectTarget(
          '/'
          r'\evil.example.com',
        ),
        isNull,
      );
      expect(safeRedirectTarget(r'\\evil.example.com'), isNull);
      expect(safeRedirectTarget('%2F%2Fevil.example.com'), isNull);
      expect(safeRedirectTarget('/%2fevil.example.com'), isNull);
      expect(safeRedirectTarget('/%2Fevil.example.com'), isNull);
    });

    test('rejects control characters', () {
      expect(safeRedirectTarget('/orders\nSet-Cookie: a=b'), isNull);
      expect(safeRedirectTarget('/orders\r\nX'), isNull);
      expect(safeRedirectTarget('/orders${String.fromCharCode(0)}'), isNull);
    });

    test('rejects the auth screens so login cannot loop on itself', () {
      expect(safeRedirectTarget(RoutePaths.login), isNull);
      expect(safeRedirectTarget(RoutePaths.register), isNull);
      expect(safeRedirectTarget(RoutePaths.forgotPassword), isNull);
      expect(safeRedirectTarget(RoutePaths.resetPassword), isNull);
      expect(safeRedirectTarget(RoutePaths.splash), isNull);
    });
  });

  group('redirect guard', () {
    testWidgets('a guest on a protected route is sent to sign-in', (
      tester,
    ) async {
      final router = await _pump(tester, authenticated: false);
      router.go(RoutePaths.orders);
      await tester.pumpAndSettle();

      expect(find.byType(LoginScreen), findsOneWidget);
      expect(find.text('Welcome back'), findsOneWidget);
      expect(router.state.uri.path, RoutePaths.login);
      expect(router.state.uri.queryParameters['next'], RoutePaths.orders);
    });

    testWidgets('a guest on a public route stays put', (tester) async {
      final router = await _pump(tester, authenticated: false);

      expect(router.state.uri.path, RoutePaths.home);
      expect(find.byType(LoginScreen), findsNothing);
    });

    testWidgets('a signed-in user is bounced off the login screen', (
      tester,
    ) async {
      final router = await _pump(tester, authenticated: true);
      router.go('${RoutePaths.login}?next=${Uri.encodeComponent('/cart')}');
      await tester.pumpAndSettle();

      expect(find.byType(LoginScreen), findsNothing);
      expect(router.state.uri.path, '/cart');
    });

    testWidgets(
      'a hostile ?next= cannot push the router off-origin or into a loop',
      (tester) async {
        final router = await _pump(tester, authenticated: true);

        for (final hostile in [
          '//evil.example.com',
          'https://evil.example.com',
          '/%2F%2Fevil.example.com',
          RoutePaths.login,
        ]) {
          router.go('${RoutePaths.login}?next=${Uri.encodeComponent(hostile)}');
          await tester.pumpAndSettle();

          expect(find.byType(LoginScreen), findsNothing);
          expect(router.state.uri.host, isEmpty);
          expect(router.state.uri.path, RoutePaths.home);
        }
      },
    );

    testWidgets('an unknown location degrades to home instead of throwing', (
      tester,
    ) async {
      final router = await _pump(tester, authenticated: false);
      router.go('/this-route-does-not-exist');
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(router.state.uri.path, RoutePaths.home);
    });
  });
}
