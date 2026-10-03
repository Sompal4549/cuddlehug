import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Device reachability (plan §10.1 — "You're offline" banner + retry).
///
/// [isOnlineProvider] is `true` unless the platform reports no usable
/// network. Unknown states (plugin missing in tests, platform error) default
/// to online so the UI never hides behind a false "offline" claim.
class ConnectivityService {
  new({Connectivity? connectivity})
      : _connectivity = connectivity ?? Connectivity();

  final Connectivity _connectivity;

  /// `true` when any non-[ConnectivityResult.none] transport is up.
  Future<bool> isOnline() async {
    try {
      final results = await _connectivity.checkConnectivity();
      return hasLink(results);
    } on Object {
      return true;
    }
  }

  /// Emits the current state immediately, then every change after it.
  Stream<bool> watch() async* {
    yield await isOnline();
    try {
      yield* _connectivity.onConnectivityChanged.map(hasLink);
    } on Object {
      // Stream unavailable (e.g. test platform) — the initial value stands.
    }
  }

  /// `true` when any non-[ConnectivityResult.none] transport is up.
  static bool hasLink(List<ConnectivityResult> results) =>
      results.any((result) => result != ConnectivityResult.none);
}

final connectivityServiceProvider = Provider<ConnectivityService>(
  (ref) => ConnectivityService(),
);

/// Last-known reachability; starts online until the first check answers.
final isOnlineProvider = StreamProvider<bool>(
  (ref) => ref.watch(connectivityServiceProvider).watch(),
);
