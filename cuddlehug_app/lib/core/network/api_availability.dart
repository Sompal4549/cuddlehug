import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Backend reachability, which is **not** the same thing as device
/// connectivity:
///
/// ```text
/// device connectivity  (`isOnlineProvider`)  — radio / Wi-Fi link is up
/// internet availability                     — the link actually routes
/// API availability    (this file)           — our backend answered
/// ```
///
/// WiFi can be up while the backend is down, and the backend can be fine
/// while the device has no route. The offline banner keys off
/// `isOnlineProvider` for "You're offline" and off this provider for
/// "Can't reach the server"; screen-level failures keep surfacing through
/// `ApiException` regardless.
///
/// [ApiAvailability.unreachable] requires **two consecutive transport
/// failures** so a single blip never flashes a banner, and any HTTP response
/// (even a 5xx — the server *did* answer) clears it immediately.
enum ApiAvailability { unknown, reachable, unreachable }

class ApiAvailabilityController extends Notifier<ApiAvailability> {
  static const failureThreshold = 2;

  int _consecutiveFailures = 0;

  @override
  ApiAvailability build() => ApiAvailability.unknown;

  /// Called by the network instrumentation layer.
  void report({required bool transportFailure}) {
    if (!transportFailure) {
      _consecutiveFailures = 0;
      if (state != ApiAvailability.reachable) {
        state = ApiAvailability.reachable;
      }
      return;
    }
    _consecutiveFailures++;
    if (_consecutiveFailures >= failureThreshold &&
        state != ApiAvailability.unreachable) {
      state = ApiAvailability.unreachable;
    }
  }

  /// Manual retry (banner button) — forgets the failure streak so the next
  /// probe decides honestly.
  void reset() {
    _consecutiveFailures = 0;
    if (state != ApiAvailability.unknown) state = ApiAvailability.unknown;
  }
}

final apiAvailabilityProvider =
    NotifierProvider<ApiAvailabilityController, ApiAvailability>(
      ApiAvailabilityController.new,
    );
