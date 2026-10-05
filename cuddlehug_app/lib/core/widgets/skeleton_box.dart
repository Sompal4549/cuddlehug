import 'package:cuddlehug_app/core/theme/colors.dart';
import 'package:cuddlehug_app/core/theme/spacing.dart';
import 'package:flutter/material.dart';

/// Pulsing placeholder block used while content loads (no shimmer package —
/// plan keeps dependencies lean).
class SkeletonBox extends StatefulWidget {
  const new({
    required this.width,
    required this.height,
    super.key,
    this.radius = AppSpacing.radiusMd,
  });

  final double width;
  final double height;
  final double radius;

  @override
  State<SkeletonBox> createState() => _SkeletonBoxState();
}

class _SkeletonBoxState extends State<SkeletonBox>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 800),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => FadeTransition(
    opacity: Tween<double>(begin: 0.35, end: 0.85).animate(_controller),
    child: Container(
      width: widget.width,
      height: widget.height,
      decoration: BoxDecoration(
        color: AppColors.muted,
        borderRadius: BorderRadius.circular(widget.radius),
      ),
    ),
  );
}
