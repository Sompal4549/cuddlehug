import 'package:cuddlehug_app/core/network/api_availability.dart';
import 'package:cuddlehug_app/core/theme/colors.dart';
import 'package:cuddlehug_app/core/utils/connectivity_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Slim persistent banner that separates the two failure modes the app can
/// actually distinguish (plan §10.1 / §19):
///
/// * **device offline** — `isOnlineProvider` says there is no link at all;
/// * **backend unreachable** — the link is fine but our API has failed
///   transport-level twice in a row (`apiAvailabilityProvider`).
///
/// The banner never blocks interaction and never hides content: screens keep
/// rendering and keep surfacing their own `ApiException` state. Wraps the
/// whole app through `MaterialApp.router.builder` so every screen gets it
/// without per-screen wiring.
class OfflineBanner extends ConsumerWidget {
  const new({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final offline = switch (ref.watch(isOnlineProvider)) {
      AsyncData(value: final online) => !online,
      _ => false,
    };
    // Only meaningful while the device itself has a link — otherwise the
    // offline message above is the accurate one.
    final backendDown =
        !offline &&
        ref.watch(apiAvailabilityProvider) == ApiAvailability.unreachable;

    final message = offline
        ? "You're offline"
        : backendDown
        ? "Can't reach the server"
        : null;

    return Column(
      children: [
        if (message != null)
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
                      Icon(
                        offline
                            ? Icons.wifi_off_rounded
                            : Icons.cloud_off_rounded,
                        size: 14,
                        color: AppColors.foreground,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        message,
                        style: const TextStyle(
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
                        onPressed: () {
                          // Forget the failure streak so the next probe
                          // decides honestly, then re-check the link.
                          ref.read(apiAvailabilityProvider.notifier).reset();
                          ref.invalidate(isOnlineProvider);
                        },
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
