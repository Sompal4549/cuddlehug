import 'package:cuddlehug_app/core/routing/responsive.dart';
import 'package:cuddlehug_app/core/routing/route_paths.dart';
import 'package:cuddlehug_app/core/theme/colors.dart';
import 'package:cuddlehug_app/features/account/account_screen.dart';
import 'package:cuddlehug_app/features/account/presentation/address_book_screen.dart';
import 'package:cuddlehug_app/features/account/presentation/address_edit_screen.dart';
import 'package:cuddlehug_app/features/account/presentation/change_password_screen.dart';
import 'package:cuddlehug_app/features/account/presentation/notifications_screen.dart';
import 'package:cuddlehug_app/features/account/presentation/profile_screen.dart';
import 'package:cuddlehug_app/features/account/presentation/settings_screen.dart';
import 'package:cuddlehug_app/features/auth/presentation/forgot_password_screen.dart';
import 'package:cuddlehug_app/features/auth/presentation/login_screen.dart';
import 'package:cuddlehug_app/features/auth/presentation/register_screen.dart';
import 'package:cuddlehug_app/features/auth/presentation/reset_password_screen.dart';
import 'package:cuddlehug_app/features/cart/application/cart_controller.dart';
import 'package:cuddlehug_app/features/cart/cart_screen.dart';
import 'package:cuddlehug_app/features/catalog/presentation/categories_screen.dart';
import 'package:cuddlehug_app/features/catalog/presentation/product_detail_screen.dart';
import 'package:cuddlehug_app/features/catalog/presentation/search_screen.dart';
import 'package:cuddlehug_app/features/catalog/presentation/wishlist_screen.dart';
import 'package:cuddlehug_app/features/checkout/presentation/checkout_screen.dart';
import 'package:cuddlehug_app/features/checkout/presentation/order_confirmation_screen.dart';
import 'package:cuddlehug_app/features/home/home_screen.dart';
import 'package:cuddlehug_app/features/orders/presentation/order_detail_screen.dart';
import 'package:cuddlehug_app/features/orders/presentation/orders_screen.dart';
import 'package:cuddlehug_app/features/shop/shop_screen.dart';
import 'package:cuddlehug_app/features/splash/splash_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Auth screens that must never be accepted as a `next=` destination —
/// bouncing straight back to them after login would loop.
const _authLoopPaths = <String>{
  RoutePaths.login,
  RoutePaths.register,
  RoutePaths.forgotPassword,
  RoutePaths.resetPassword,
  RoutePaths.splash,
};

/// Validates a `?next=` (or deep-link) target before the router follows it.
///
/// Accepts only in-app absolute paths. Rejects scheme-relative URLs
/// (`//host`), backslashes, encoded slashes (`%2f` would decode into a
/// `//host` authority), control characters and the auth screens themselves,
/// so an untrusted link can neither escape the app origin nor create a
/// redirect loop. Returns `null` when the value must be ignored.
String? safeRedirectTarget(String? next) {
  if (next == null || next.isEmpty) return null;
  if (!next.startsWith('/')) return null;
  if (next.startsWith('//')) return null;
  if (next.contains(r'\')) return null;
  if (next.toLowerCase().contains('%2f')) return null;
  if (next.contains('\n') || next.contains('\r') || next.contains('\u0000')) {
    return null;
  }
  final uri = Uri.tryParse(next);
  if (uri == null) return null;
  if (_authLoopPaths.contains(uri.path)) return null;
  return next;
}

/// Builds the app router (fresh instance per call — tests build their own).
///
/// [isAuthenticated] is read at redirect time so the guard reacts to auth
/// changes; [refreshListenable] is bumped by the auth controller on every
/// state change so GoRouter re-runs the redirect.
GoRouter buildAppRouter({
  String initialLocation = RoutePaths.splash,
  bool Function()? isAuthenticated,
  Listenable? refreshListenable,
}) {
  final authed = isAuthenticated ?? () => false;
  return GoRouter(
    initialLocation: initialLocation,
    refreshListenable: refreshListenable,
    // Unknown locations (stale deep links, mistyped pushes) must degrade to
    // home instead of throwing — an unmatched route is not an app crash.
    onException: (context, state, router) => router.go(RoutePaths.home),
    redirect: (context, state) {
      final location = state.matchedLocation;
      final needsAuth = _protectedPrefixes.any(
        (prefix) => location == prefix || location.startsWith('$prefix/'),
      );
      if (needsAuth && !authed()) {
        // Preserve the intended destination so login can restore it.
        final next = Uri.encodeComponent(state.uri.toString());
        return '${RoutePaths.login}?next=$next';
      }
      if (authed() &&
          (location == RoutePaths.login || location == RoutePaths.register)) {
        return safeRedirectTarget(state.uri.queryParameters['next']) ??
            RoutePaths.home;
      }
      return null;
    },
    routes: [
      GoRoute(
        path: RoutePaths.splash,
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: RoutePaths.login,
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: RoutePaths.register,
        builder: (context, state) => const RegisterScreen(),
      ),
      GoRoute(
        path: RoutePaths.forgotPassword,
        builder: (context, state) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: RoutePaths.resetPassword,
        builder: (context, state) => ResetPasswordScreen(
          token: state.uri.queryParameters['token'] ?? '',
        ),
      ),
      GoRoute(
        path: RoutePaths.search,
        builder: (context, state) => const SearchScreen(),
      ),
      GoRoute(
        path: RoutePaths.categories,
        builder: (context, state) => const CategoriesScreen(),
      ),
      GoRoute(
        path: RoutePaths.productDetailPath,
        builder: (context, state) =>
            ProductDetailScreen(slug: state.pathParameters['slug'] ?? ''),
      ),
      GoRoute(
        path: RoutePaths.categoryPath,
        builder: (context, state) =>
            CategoryScreen(slug: state.pathParameters['slug'] ?? ''),
      ),
      GoRoute(
        path: RoutePaths.wishlist,
        builder: (context, state) => const WishlistScreen(),
      ),
      GoRoute(
        path: RoutePaths.checkout,
        builder: (context, state) => const CheckoutScreen(),
      ),
      GoRoute(
        path: RoutePaths.orders,
        builder: (context, state) => const OrdersScreen(),
      ),
      // Must precede `/orders/:id` so "confirmation" is not swallowed as
      // an order id.
      GoRoute(
        path: RoutePaths.orderConfirmation,
        builder: (context, state) => const OrderConfirmationScreen(),
      ),
      GoRoute(
        path: '/orders/:id',
        builder: (context, state) =>
            OrderDetailScreen(orderId: state.pathParameters['id'] ?? ''),
      ),
      GoRoute(
        path: RoutePaths.addresses,
        builder: (context, state) => const AddressBookScreen(),
      ),
      GoRoute(
        path: RoutePaths.addressNew,
        builder: (context, state) => const AddressEditScreen(),
      ),
      GoRoute(
        path: '/addresses/:id',
        builder: (context, state) =>
            AddressEditScreen(addressId: state.pathParameters['id']),
      ),
      GoRoute(
        path: RoutePaths.profile,
        builder: (context, state) => const ProfileScreen(),
      ),
      GoRoute(
        path: RoutePaths.profilePassword,
        builder: (context, state) => const ChangePasswordScreen(),
      ),
      GoRoute(
        path: RoutePaths.notifications,
        builder: (context, state) => const NotificationsScreen(),
      ),
      // Public: store info, privacy and terms.
      GoRoute(
        path: RoutePaths.settings,
        builder: (context, state) => const SettingsScreen(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            _AppShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: RoutePaths.home,
                builder: (context, state) => const HomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: RoutePaths.shop,
                builder: (context, state) => const ShopScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: RoutePaths.cart,
                builder: (context, state) => const CartScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: RoutePaths.account,
                builder: (context, state) => const AccountScreen(),
              ),
            ],
          ),
        ],
      ),
    ],
  );
}

/// Routes that require a signed-in customer (plan §5 guards).
const _protectedPrefixes = <String>[
  RoutePaths.account,
  RoutePaths.orders,
  RoutePaths.checkout,
  RoutePaths.profile,
  RoutePaths.addresses,
  RoutePaths.notifications,
  RoutePaths.wishlist,
];

class _AppShell extends ConsumerWidget {
  const new({required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  void _goBranch(int index) => navigationShell.goBranch(
    index,
    // Return to the branch root when re-tapping the active tab.
    initialLocation: index == navigationShell.currentIndex,
  );

  List<NavigationRailDestination> _railDestinations(int cartCount) => [
    const NavigationRailDestination(
      icon: Icon(Icons.home_outlined),
      label: Text('Home'),
    ),
    const NavigationRailDestination(
      icon: Icon(Icons.grid_view_outlined),
      label: Text('Shop'),
    ),
    NavigationRailDestination(
      icon: Badge(
        isLabelVisible: cartCount > 0,
        label: Text('$cartCount'),
        child: const Icon(Icons.shopping_bag_outlined),
      ),
      label: const Text('Cart'),
    ),
    const NavigationRailDestination(
      icon: Icon(Icons.person_outline),
      label: Text('Account'),
    ),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cartCount = ref.watch(
      cartProvider.select((state) => state.itemCount),
    );
    // Plan §14.1: expanded (≥840dp) swaps the bottom bar for a left rail.
    if (Breakpoints.isExpanded(context)) {
      return Scaffold(
        body: Row(
          children: [
            NavigationRail(
              selectedIndex: navigationShell.currentIndex,
              onDestinationSelected: _goBranch,
              labelType: NavigationRailLabelType.all,
              selectedLabelTextStyle: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
              destinations: _railDestinations(cartCount),
            ),
            const VerticalDivider(width: 1, thickness: 1),
            Expanded(child: navigationShell),
          ],
        ),
      );
    }
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: navigationShell.currentIndex,
        onTap: _goBranch,
        items: [
          const BottomNavigationBarItem(
            icon: Icon(Icons.home_outlined),
            label: 'Home',
          ),
          const BottomNavigationBarItem(
            icon: Icon(Icons.grid_view_outlined),
            label: 'Shop',
          ),
          BottomNavigationBarItem(
            icon: Badge(
              isLabelVisible: cartCount > 0,
              label: Text('$cartCount'),
              child: const Icon(Icons.shopping_bag_outlined),
            ),
            label: 'Cart',
          ),
          const BottomNavigationBarItem(
            icon: Icon(Icons.person_outline),
            label: 'Account',
          ),
        ],
        selectedItemColor: AppColors.primary,
        unselectedItemColor: AppColors.mutedForeground,
      ),
    );
  }
}
