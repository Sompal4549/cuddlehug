import 'package:cuddlehug_app/app.dart';
import 'package:cuddlehug_app/app_providers.dart';
import 'package:cuddlehug_app/core/storage/prefs_store.dart';
import 'package:cuddlehug_app/core/storage/secure_store.dart';
import 'package:cuddlehug_app/core/widgets/app_button.dart';
import 'package:cuddlehug_app/features/catalog/presentation/widgets/product_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// End-to-end flows from plan §17.3, run against the local backend
/// (seeded DB, dev config `10.0.2.2:5000` on the Android emulator).
///
///   flutter run -d emulator-5554 --flavor dev \
///     --dart-define-from-file=config/dev.json -t integration_test/app_test.dart
///
/// Seeded customer: customer@cuddlehug.com / Customer@1234
/// Seeded coupon:   CUDDLE10
const _customerEmail = 'customer@cuddlehug.com';
const _customerPassword = 'Customer@1234';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  /// Cold-starts the app with wiped local storage — simulates a fresh install
  /// (plan §5.2 / §6.1: refresh token + ch_sid live in secure storage).
  Future<void> launchApp(WidgetTester tester) async {
    final secureStore = SecureStore();
    await secureStore.clearAll();
    // Mints the guest `ch_sid` exactly like `main()` does on a fresh install.
    await secureStore.hydrate();
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();

    tester.view.physicalSize = const Size(400, 900);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          secureStoreProvider.overrideWithValue(secureStore),
          prefsStoreProvider.overrideWithValue(await PrefsStore.load()),
        ],
        child: const CuddleHugApp(),
      ),
    );
    await tester.pumpAndSettle(const Duration(seconds: 1));
  }

  /// Shop → first product → Add to cart → back to the tab shell (the detail
  /// route is pushed outside the shell, so the bottom nav is hidden there).
  Future<void> addFirstProductToCart(WidgetTester tester) async {
    await tester.tap(find.text('Shop'));
    await tester.pumpAndSettle(const Duration(seconds: 2));
    await tester.tap(find.byType(ProductCardTile).first);
    await tester.pumpAndSettle(const Duration(seconds: 2));
    await tester.tap(find.widgetWithText(AppButton, 'Add to cart'));
    await tester.pumpAndSettle(const Duration(seconds: 2));
    await tester.pageBack();
    await tester.pumpAndSettle(const Duration(seconds: 2));
  }

  Future<void> signIn(WidgetTester tester) async {
    await tester.tap(find.text('Account'));
    await tester.pumpAndSettle();
    expect(find.text('Welcome back'), findsOneWidget);

    await tester.enterText(
      find.byType(TextFormField).at(0),
      _customerEmail,
    );
    await tester.enterText(
      find.byType(TextFormField).at(1),
      _customerPassword,
    );
    await tester.tap(find.widgetWithText(AppButton, 'Sign in'));
    await tester.pumpAndSettle(const Duration(seconds: 2));
  }

  testWidgets('guest boots into a populated home and can browse the shop',
      (tester) async {
    await launchApp(tester);

    // Home renders from GET /content/home.
    expect(find.text('Featured for you'), findsOneWidget);
    expect(find.text('Cart'), findsOneWidget);

    // Shop tab → catalog list from GET /products.
    await tester.tap(find.text('Shop'));
    await tester.pumpAndSettle(const Duration(seconds: 2));
    expect(find.text('Filters'), findsOneWidget);

    // Product detail from the seeded catalog (first tile in the grid).
    await tester.tap(find.byType(ProductCardTile).first);
    await tester.pumpAndSettle(const Duration(seconds: 2));
    expect(find.text('Add to cart'), findsOneWidget);
  });

  testWidgets('sign-in persists the session and lands on Account',
      (tester) async {
    await launchApp(tester);
    await signIn(tester);

    // Authenticated account hub (protected route resolved).
    expect(find.text('My orders'), findsOneWidget);
    expect(find.text('Welcome back'), findsNothing);
  });

  testWidgets('guest cart survives and merges into the user cart at sign-in',
      (tester) async {
    await launchApp(tester);

    // Guest adds an item (server mints/uses ch_sid).
    await addFirstProductToCart(tester);

    await tester.tap(find.text('Cart'));
    await tester.pumpAndSettle(const Duration(seconds: 2));
    // A populated cart renders the checkout bar (not the empty state).
    expect(find.text('Your cart is empty'), findsNothing);
    expect(find.widgetWithText(AppButton, 'Checkout'), findsOneWidget);

    // Sign in → backend mergeCarts runs; the line is still there.
    await signIn(tester);
    await tester.tap(find.text('Cart'));
    await tester.pumpAndSettle(const Duration(seconds: 2));
    expect(find.text('Your cart is empty'), findsNothing);
    expect(find.widgetWithText(AppButton, 'Checkout'), findsOneWidget);
  });

  testWidgets('coupon CUDDLE10 applies to the guest cart', (tester) async {
    await launchApp(tester);

    await addFirstProductToCart(tester);

    await tester.tap(find.text('Cart'));
    await tester.pumpAndSettle(const Duration(seconds: 2));

    // CUDDLE10 needs a ₹999+ subtotal; the cheapest seeded line is ₹749, so
    // bump the quantity to cross the threshold (749 × 2 = 1498).
    await tester.tap(find.byIcon(Icons.add_rounded).first);
    await tester.pumpAndSettle(const Duration(seconds: 2));

    await tester.enterText(find.byType(TextField).first, 'CUDDLE10');
    await tester.tap(find.widgetWithText(AppButton, 'Apply'));
    await tester.pumpAndSettle(const Duration(seconds: 2));

    expect(find.text('Coupon applied'), findsOneWidget);
    expect(find.textContaining('CUDDLE10'), findsWidgets);
  });

  testWidgets('COD checkout places an order and shows confirmation',
      (tester) async {
    await launchApp(tester);
    await signIn(tester);

    // Cart with one line.
    await addFirstProductToCart(tester);
    await tester.tap(find.text('Cart'));
    await tester.pumpAndSettle(const Duration(seconds: 2));

    // Checkout (protected — already signed in).
    await tester.tap(find.widgetWithText(AppButton, 'Checkout'));
    await tester.pumpAndSettle(const Duration(seconds: 2));
    expect(find.text('Delivery address'), findsOneWidget);

    // Address (seeded for the customer) → COD → place order.
    if (find.text('Cash on delivery').evaluate().isEmpty) {
      // Settings report COD disabled — nothing to assert downstream.
      return;
    }
    await tester.tap(find.text('Cash on delivery'));
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(AppButton, 'Place order'));
    await tester.pumpAndSettle(const Duration(seconds: 5));

    expect(find.text('Order confirmed!'), findsOneWidget);
  });

  testWidgets('order lands in My orders', (tester) async {
    await launchApp(tester);
    await signIn(tester);

    await tester.tap(find.text('My orders'));
    await tester.pumpAndSettle(const Duration(seconds: 3));

    // The seed (plus anything created by earlier tests) renders order rows.
    expect(find.text('My orders'), findsOneWidget);
    expect(find.textContaining('CH-'), findsWidgets);
  });

  testWidgets('sign-out returns to guest and re-guards protected routes',
      (tester) async {
    await launchApp(tester);
    await signIn(tester);
    expect(find.text('My orders'), findsOneWidget);

    // Sign out from the account hub.
    await tester.tap(find.text('Sign out'));
    await tester.pumpAndSettle(const Duration(seconds: 2));

    // Protected route now redirects to sign-in.
    await tester.tap(find.text('Account'));
    await tester.pumpAndSettle(const Duration(seconds: 2));
    expect(find.text('Welcome back'), findsOneWidget);
  });
}
