import 'package:flutter/material.dart';

/// Window classes from plan §14.1 (aligned to Tailwind + Material window
/// classes): compact < 600dp (phones), medium 600–839dp (tablet portrait),
/// expanded ≥ 840dp (tablet landscape / iPad).
enum WindowClass { compact, medium, expanded }

abstract final class Breakpoints {
  /// Below this width the layout is `compact`.
  static const double compactMax = 600;

  /// At or above this width the layout is `expanded`.
  static const double expandedMin = 840;

  /// Content cap on wide screens (`max-w-7xl` equivalent, plan §14.1).
  static const double maxContentWidth = 1280;

  static WindowClass ofWidth(double width) {
    if (width < compactMax) return WindowClass.compact;
    if (width < expandedMin) return WindowClass.medium;
    return WindowClass.expanded;
  }

  static WindowClass of(BuildContext context) =>
      ofWidth(MediaQuery.sizeOf(context).width);

  static bool isExpanded(BuildContext context) =>
      of(context) == WindowClass.expanded;

  /// Gutter per class (plan §14.1: 24dp on medium, wider on expanded).
  static double gutter(BuildContext context) => switch (of(context)) {
    WindowClass.compact => 16,
    WindowClass.medium => 24,
    WindowClass.expanded => 32,
  };

  /// Grid columns per class (plan §14.3: 2 → 3 → 4).
  static int gridColumns(BuildContext context) => switch (of(context)) {
    WindowClass.compact => 2,
    WindowClass.medium => 3,
    WindowClass.expanded => 4,
  };
}
