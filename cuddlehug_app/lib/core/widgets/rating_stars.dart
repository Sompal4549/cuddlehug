import 'package:cuddlehug_app/core/theme/colors.dart';
import 'package:flutter/material.dart';

/// Star rating row: ★★★★½ plus optional trailing count.
class RatingStars extends StatelessWidget {
  const new({
    required this.value,
    super.key,
    this.size = 16,
    this.count,
    this.countText,
  });

  final double value;
  final double size;
  final int? count;

  /// Overrides the "(12)" count label when the caller has richer copy
  /// (e.g. "12 reviews").
  final String? countText;

  @override
  Widget build(BuildContext context) {
    final stars = List.generate(5, (index) {
      final filled = index + 1 <= value.round();
      return Icon(
        filled ? Icons.star_rounded : Icons.star_outline_rounded,
        size: size,
        color: AppColors.warning,
      );
    });
    final label =
        countText ?? (count != null && count! > 0 ? ' ($count)' : null);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        ...stars,
        if (label != null)
          Text(
            label,
            style: TextStyle(
              fontSize: size * 0.85,
              color: AppColors.mutedForeground,
              fontWeight: FontWeight.w500,
            ),
          ),
      ],
    );
  }
}
