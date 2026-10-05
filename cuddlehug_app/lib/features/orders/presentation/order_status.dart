import 'package:cuddlehug_app/core/theme/colors.dart';
import 'package:flutter/material.dart';

/// Display helpers shared by the orders list and detail screens.
String orderStatusLabel(String status) => switch (status) {
  'PENDING' => 'Order placed',
  'CONFIRMED' => 'Confirmed',
  'PROCESSING' => 'Processing',
  'PACKED' => 'Packed',
  'SHIPPED' => 'Shipped',
  'OUT_FOR_DELIVERY' => 'Out for delivery',
  'DELIVERED' => 'Delivered',
  'CANCELLED' => 'Cancelled',
  'RETURNED' => 'Returned',
  'REFUNDED' => 'Refunded',
  _ => status,
};

Color orderStatusColor(String status) => switch (status) {
  'DELIVERED' => AppColors.success,
  'CANCELLED' || 'RETURNED' || 'REFUNDED' => AppColors.destructive,
  'OUT_FOR_DELIVERY' || 'SHIPPED' => AppColors.primary,
  'PENDING' || 'CONFIRMED' => AppColors.warning,
  _ => AppColors.onAccent,
};

Color paymentStatusColor(String status) => switch (status) {
  'PAID' => AppColors.success,
  'FAILED' => AppColors.destructive,
  'REFUNDED' => AppColors.warning,
  _ => AppColors.mutedForeground,
};
