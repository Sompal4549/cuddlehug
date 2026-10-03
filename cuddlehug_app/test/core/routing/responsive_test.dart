import 'package:cuddlehug_app/core/routing/responsive.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('window classes follow plan 14.1 thresholds', () {
    expect(Breakpoints.ofWidth(390), WindowClass.compact);
    expect(Breakpoints.ofWidth(599), WindowClass.compact);
    expect(Breakpoints.ofWidth(600), WindowClass.medium);
    expect(Breakpoints.ofWidth(839), WindowClass.medium);
    expect(Breakpoints.ofWidth(840), WindowClass.expanded);
    expect(Breakpoints.ofWidth(1280), WindowClass.expanded);
  });

  testWidgets('grid columns step 2 → 3 → 4 by width', (tester) async {
    Future<int> columnsFor(double width) async {
      tester.view.physicalSize = Size(width, 800);
      tester.view.devicePixelRatio = 1;
      late int columns;
      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) {
              columns = Breakpoints.gridColumns(context);
              return const SizedBox.shrink();
            },
          ),
        ),
      );
      return columns;
    }

    expect(await columnsFor(390), 2);
    expect(await columnsFor(700), 3);
    expect(await columnsFor(1000), 4);
    addTearDown(tester.view.reset);
  });

  testWidgets('gutter widens with the window class', (tester) async {
    Future<double> gutterFor(double width) async {
      tester.view.physicalSize = Size(width, 800);
      tester.view.devicePixelRatio = 1;
      late double gutter;
      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) {
              gutter = Breakpoints.gutter(context);
              return const SizedBox.shrink();
            },
          ),
        ),
      );
      return gutter;
    }

    expect(await gutterFor(390), 16);
    expect(await gutterFor(700), 24);
    expect(await gutterFor(1000), 32);
    addTearDown(tester.view.reset);
  });

  testWidgets('isExpanded flips on at 840dp', (tester) async {
    Future<bool> expandedFor(double width) async {
      tester.view.physicalSize = Size(width, 800);
      tester.view.devicePixelRatio = 1;
      late bool expanded;
      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) {
              expanded = Breakpoints.isExpanded(context);
              return const SizedBox.shrink();
            },
          ),
        ),
      );
      return expanded;
    }

    expect(await expandedFor(839), isFalse);
    expect(await expandedFor(840), isTrue);
    addTearDown(tester.view.reset);
  });
}
