import 'package:cuddlehug_app/core/theme/colors.dart';
import 'package:cuddlehug_app/core/utils/connectivity_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Slim persistent banner shown while the device has no connection
/// (plan §10.1). Wraps the whole app through `MaterialApp.router.builder`
/// so every screen gets it without per-screen wiring.
class OfflineBanner extends ConsumerWidget {
  const new({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final offline = switch (ref.watch(isOnlineProvider)) {
      AsyncData(value: final online) => !online,
      _ => false,
    };
    return Column(
      children: [
        if (offline)
          Material(
            color: AppColors.warning,
            child: SafeArea(
              bottom: false,
              child: SizedBox(
                width: double.infinity,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(
                        Icons.wifi_off_rounded,
                        size: 14,
                        color: AppColors.foreground,
                      ),
                      const SizedBox(width: 6),
                      const Text(
                        "You're offline",
                        style: TextStyle(
                          color: AppColors.foreground,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      TextButton(
                        style: TextButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                          minimumSize: const Size(0, 24),
                          foregroundColor: AppColors.foreground,
                          textStyle: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        onPressed: () => ref.invalidate(isOnlineProvider),
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        Expanded(child: child),
      ],
    );
  }
}
