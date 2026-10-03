import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:cuddlehug_app/core/utils/connectivity_service.dart';
import 'package:cuddlehug_app/core/widgets/offline_banner.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeConnectivityService extends ConnectivityService {
  new({required this.online});

  bool online;
  int checks = 0;

  @override
  Future<bool> isOnline() async {
    checks++;
    return online;
  }

  @override
  Stream<bool> watch() async* {
    yield await isOnline();
  }
}

void main() {
  test('reports online when any transport is up', () {
    expect(
      ConnectivityService.hasLink([
        ConnectivityResult.none,
        ConnectivityResult.wifi,
      ]),
      isTrue,
    );
    expect(ConnectivityService.hasLink([ConnectivityResult.none]), isFalse);
  });

  ProviderScope scope(_FakeConnectivityService service, Widget child) =>
      ProviderScope(
        overrides: [connectivityServiceProvider.overrideWithValue(service)],
        child: child,
      );

  group('OfflineBanner', () {
    testWidgets('stays hidden while online', (tester) async {
      final service = _FakeConnectivityService(online: true);
      await tester.pumpWidget(
        scope(
          service,
          const MaterialApp(home: OfflineBanner(child: Text('content'))),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text("You're offline"), findsNothing);
      expect(find.text('content'), findsOneWidget);
    });

    testWidgets('shows the banner and Retry when offline', (tester) async {
      final service = _FakeConnectivityService(online: false);
      await tester.pumpWidget(
        scope(
          service,
          const MaterialApp(home: OfflineBanner(child: Text('content'))),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text("You're offline"), findsOneWidget);
      expect(find.text('Retry'), findsOneWidget);
      expect(find.text('content'), findsOneWidget);
    });

    testWidgets('Retry re-checks connectivity', (tester) async {
      final service = _FakeConnectivityService(online: false);
      await tester.pumpWidget(
        scope(
          service,
          const MaterialApp(home: OfflineBanner(child: Text('content'))),
        ),
      );
      await tester.pumpAndSettle();
      final before = service.checks;

      await tester.tap(find.text('Retry'));
      await tester.pumpAndSettle();

      expect(service.checks, greaterThan(before));
    });
  });
}
