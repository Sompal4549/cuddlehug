
import 'package:cuddlehug_app/core/routing/route_paths.dart';
import 'package:cuddlehug_app/core/theme/colors.dart';
import 'package:cuddlehug_app/core/widgets/wide_body.dart';
import 'package:cuddlehug_app/features/account/application/notifications_controller.dart';
import 'package:cuddlehug_app/features/auth/application/auth_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Account tab: profile, orders, addresses, notifications, settings.
class AccountScreen extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authenticated = ref.watch(
      authControllerProvider.select((auth) => auth.isAuthenticated),
    );
    final unread = authenticated
        ? ref.watch(notificationsProvider.select((s) => s.unread))
        : 0;
    return Scaffold(
      appBar: AppBar(title: const Text('Account')),
      body: WideBody(
        child: ListView(
          padding: const EdgeInsets.symmetric(vertical: 8),
          children: [
          if (authenticated)
            ListTile(
              leading: const Icon(Icons.person_outline_rounded),
              title: const Text('Profile'),
              subtitle: const Text('Name, phone and password'),
              trailing: const Icon(Icons.chevron_right_rounded),
              onTap: () => context.push(RoutePaths.profile),
            ),
          ListTile(
            leading: const Icon(Icons.receipt_long_outlined),
            title: const Text('My orders'),
            subtitle: const Text('Track, view totals and delivery status'),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: () => context.push(RoutePaths.orders),
          ),
          ListTile(
            leading: const Icon(Icons.location_on_outlined),
            title: const Text('Addresses'),
            subtitle: const Text('Manage delivery addresses'),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: () => context.push(RoutePaths.addresses),
          ),
          if (authenticated)
            ListTile(
              leading: const Icon(Icons.notifications_none_rounded),
              title: const Text('Notifications'),
              subtitle: const Text('Order and delivery updates'),
              trailing: unread > 0
                  ? Badge(
                      label: Text('$unread'),
                      backgroundColor: AppColors.primary,
                      child: const Icon(Icons.chevron_right_rounded),
                    )
                  : const Icon(Icons.chevron_right_rounded),
              onTap: () => context.push(RoutePaths.notifications),
            ),
          if (!authenticated)
            ListTile(
              leading: const Icon(Icons.login_rounded),
              title: const Text(
                'Sign in',
                style: TextStyle(color: AppColors.primary),
              ),
              subtitle: const Text('Sync wishlist, orders and addresses'),
              onTap: () => context.push(RoutePaths.login),
            ),
          ListTile(
            leading: const Icon(Icons.settings_outlined),
            title: const Text('Settings'),
            subtitle: const Text('Store info, privacy and terms'),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: () => context.push(RoutePaths.settings),
          ),
          if (authenticated)
            ListTile(
              leading: const Icon(Icons.logout_rounded),
              title: const Text(
                'Sign out',
                style: TextStyle(color: AppColors.destructive),
              ),
              onTap: () async {
                await ref.read(authControllerProvider.notifier).logout();
                if (context.mounted) context.go(RoutePaths.home);
              },
            ),
        ],
        ),
      ),
    );
  }
}
