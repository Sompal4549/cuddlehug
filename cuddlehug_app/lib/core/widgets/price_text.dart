import 'package:cuddlehug_app/core/theme/colors.dart';
import 'package:cuddlehug_app/core/utils/formatters.dart';
import 'package:cuddlehug_app/core/utils/money.dart';
import 'package:flutter/material.dart';

/// Price display: current price, struck-through MRP and "% off" tag —
/// mirrors the web product card (plan §16).
class PriceText extends StatelessWidget {
  const new({
    required this.price,
    super.key,
    this.mrp,
    this.discountPercent,
    this.fontSize = 16,
    this.showDiscount = true,
  });

  final Money price;
  final Money? mrp;
  final int? discountPercent;
  final double fontSize;
  final bool showDiscount;

  bool get _showMrp => mrp != null && mrp!.compareTo(price) > 0;

  @override
  Widget build(BuildContext context) {
    final discount = discountPercent ?? 0;
    return Wrap(
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: 6,
      runSpacing: 2,
      children: [
        Text(
          formatMoney(price),
          style: TextStyle(
            fontSize: fontSize,
            fontWeight: FontWeight.w700,
            color: AppColors.foreground,
          ),
        ),
        if (_showMrp)
          Text(
            formatMoney(mrp!),
            style: TextStyle(
              fontSize: fontSize * 0.85,
              color: AppColors.mutedForeground,
              decoration: TextDecoration.lineThrough,
            ),
          ),
        if (showDiscount && discount > 0)
          Text(
            '$discount% off',
            style: TextStyle(
              fontSize: fontSize * 0.8,
              fontWeight: FontWeight.w600,
              color: AppColors.success,
            ),
          ),
      ],
    );
  }
}
