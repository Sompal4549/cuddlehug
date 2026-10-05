import 'package:cuddlehug_app/core/network/api_availability.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  late ProviderContainer container;
  late ApiAvailabilityController controller;

  setUp(() {
    container = ProviderContainer();
    controller = container.read(apiAvailabilityProvider.notifier);
  });

  tearDown(() => container.dispose());

  ApiAvailability state() => container.read(apiAvailabilityProvider);

  test('starts unknown so neither banner shows on a cold start', () {
    expect(state(), ApiAvailability.unknown);
  });

  test('a single transport failure never flips the state', () {
    controller.report(transportFailure: true);

    expect(state(), ApiAvailability.unknown);
    expect(ApiAvailabilityController.failureThreshold, greaterThan(1));
  });

  test('two consecutive transport failures mark the API unreachable', () {
    controller
      ..report(transportFailure: true)
      ..report(transportFailure: true);

    expect(state(), ApiAvailability.unreachable);
  });

  test('a successful call at any point clears an unreachable streak', () {
    controller
      ..report(transportFailure: true)
      ..report(transportFailure: true);
    expect(state(), ApiAvailability.unreachable);

    controller.report(transportFailure: false);

    expect(state(), ApiAvailability.reachable);
  });

  test('a success resets the counter so the next blip needs a full streak', () {
    controller
      ..report(transportFailure: true)
      ..report(transportFailure: false)
      ..report(transportFailure: true);

    expect(
      state(),
      ApiAvailability.reachable,
      reason: 'one failure after a success is still just a blip',
    );
  });

  test('the banner state is idempotent — repeated reports do not re-emit', () {
    var emissions = 0;
    container.listen<ApiAvailability>(
      apiAvailabilityProvider,
      (_, _) => emissions++,
    );

    controller
      ..report(transportFailure: true)
      ..report(transportFailure: true)
      ..report(transportFailure: true)
      ..report(transportFailure: true);

    expect(emissions, 1, reason: 'one unknown → unreachable transition');
  });

  test('reset forgets the streak for an honest manual retry', () {
    controller
      ..report(transportFailure: true)
      ..reset()
      ..report(transportFailure: true);

    expect(state(), ApiAvailability.unknown);
    controller.report(transportFailure: true);
    expect(state(), ApiAvailability.unreachable);
  });
}
