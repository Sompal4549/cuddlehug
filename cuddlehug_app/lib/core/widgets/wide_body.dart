import 'package:cuddlehug_app/core/routing/responsive.dart';
import 'package:flutter/material.dart';

/// Caps content width at [Breakpoints.maxContentWidth] and centers it on
/// wide screens (plan §14.1 — no unbounded line lengths on tablets).
class WideBody extends StatelessWidget {
  const new({required this.child, super.key, this.padding});

  final Widget child;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) => Center(
    child: ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: Breakpoints.maxContentWidth),
      child: padding == null ? child : Padding(padding: padding!, child: child),
    ),
  );
}
