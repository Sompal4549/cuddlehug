import 'package:cuddlehug_app/app.dart';
import 'package:cuddlehug_app/core/network/api_exception.dart';
import 'package:cuddlehug_app/features/auth/data/auth_repository.dart';
import 'package:cuddlehug_app/features/auth/data/models/user.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

const _user = User(
  id: 'u1',
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  role: 'CUSTOMER',
);

class _FakeAuthRepository implements AuthRepository {
  new({this.loginError});

  ApiException? loginError;
  String? lastEmail;

  @override
  Future<User> login({required String email, required String password}) async {
    lastEmail = email;
    final error = loginError;
    if (error != null) throw error;
    return _user;
  }

  @override
  Future<User> register({
    required String firstName,
    required String lastName,
    required String email,
    required String password,
    String? phone,
  }) async =>
      _user;

  @override
  Future<User?> refreshSilently() async => null;

  @override
  Future<void> logout() async {}

  @override
  Future<Map<String, dynamic>> forgotPassword(String email) async => {'message': 'sent'};

  @override
  Future<void> resetPassword({required String token, required String password}) async {}
}

Future<AuthRepository> _openLoginScreen(WidgetTester tester, AuthRepository repository) async {
  tester.view.devicePixelRatio = 1.0;
  tester.view.physicalSize = const Size(400, 900);
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [authRepositoryProvider.overrideWithValue(repository)],
      child: const CuddleHugApp(),
    ),
  );
  await tester.pumpAndSettle();

  await tester.tap(find.text('Account'));
  await tester.pumpAndSettle();
  expect(find.text('Welcome back'), findsOneWidget);
  return repository;
}

Future<void> _submitLogin(WidgetTester tester, {required String email, required String password}) async {
  await tester.enterText(find.byType(TextFormField).at(0), email);
  await tester.enterText(find.byType(TextFormField).at(1), password);
  await tester.tap(find.widgetWithText(ElevatedButton, 'Sign in'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('login form validates empty fields', (tester) async {
    await _openLoginScreen(tester, _FakeAuthRepository());
    await _submitLogin(tester, email: '', password: '');
    expect(find.text('Email is required'), findsOneWidget);
    expect(find.text('Password is required'), findsOneWidget);
  });

  testWidgets('successful login lands on the guarded destination', (tester) async {
    final repository = await _openLoginScreen(tester, _FakeAuthRepository());
    await _submitLogin(tester, email: 'ada@example.com', password: 'secret12');
    expect((repository as _FakeAuthRepository).lastEmail, 'ada@example.com');
    // `next=%2Faccount` was preserved by the guard — the account tab shows
    // the signed-in menu (no "Sign in" tile once authenticated).
    expect(find.text('My orders'), findsOneWidget);
    expect(find.text('Sign in'), findsNothing);
  });

  testWidgets('server-side auth failure shows the error banner', (tester) async {
    await _openLoginScreen(
      tester,
      _FakeAuthRepository(
        loginError: const ApiException(
          message: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS',
          status: 401,
        ),
      ),
    );
    await _submitLogin(tester, email: 'ada@example.com', password: 'wrongpass');
    expect(find.text('Invalid email or password'), findsOneWidget);
    expect(find.text('Welcome back'), findsOneWidget);
  });
}
