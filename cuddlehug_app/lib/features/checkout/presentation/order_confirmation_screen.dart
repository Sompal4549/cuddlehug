import 'package:cuddlehug_app/core/routing/route_paths.dart';
import 'package:cuddlehug_app/core/theme/colors.dart';
import 'package:cuddlehug_app/core/theme/spacing.dart';
import 'package:cuddlehug_app/core/utils/formatters.dart';
import 'package:cuddlehug_app/core/widgets/app_button.dart';
import 'package:cuddlehug_app/features/orders/application/orders_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Post-payment success screen (`/orders/confirmation?orderId=`).
/// Terminal by design — the app bar shows a close, not a back arrow.
class OrderConfirmationScreen extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orderId =
        GoRouterState.of(context).uri.queryParameters['orderId'] ?? '';
    final detail = orderId.isEmpty
        ? null
        : ref.watch(orderDetailProvider(orderId));

    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: false,
        actions: [
          IconButton(
            tooltip: 'Close',
            onPressed: () => context.go(RoutePaths.home),
            icon: const Icon(Icons.close_rounded),
          ),
        ],
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: detail == null
              ? _content(
                  context,
                  orderId: orderId,
                  orderNumber: null,
                  estimated: null,
                )
              : detail.when(
                  loading: () => const CircularProgressIndicator(),
                  error: (_, _) => _content(
                    context,
                    orderId: orderId,
                    orderNumber: null,
                    estimated: null,
                  ),
                  data: (order) => _content(
                    context,
                    orderId: orderId,
                    orderNumber: order.orderNumber,
                    estimated: order.estimatedDelivery,
                  ),
                ),
        ),
      ),
    );
  }

  Widget _content(
    BuildContext context, {
    required String orderId,
    required String? orderNumber,
    required DateTime? estimated,
  }) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(
        padding: const EdgeInsets.all(20),
        decoration: const BoxDecoration(
          color: AppColors.accent,
          shape: BoxShape.circle,
        ),
        child: const Icon(
          Icons.check_rounded,
          size: 48,
          color: AppColors.success,
        ),
      ),
      const SizedBox(height: AppSpacing.lg),
      const Text(
        'Order confirmed!',
        style: TextStyle(
          fontSize: 22,
          fontWeight: FontWeight.w700,
          color: AppColors.foreground,
        ),
      ),
      const SizedBox(height: AppSpacing.sm),
      const Text(
        'Thank you — your cuddly companions are on the way.',
        textAlign: TextAlign.center,
        style: TextStyle(fontSize: 14, color: AppColors.mutedForeground),
      ),
      if (orderNumber != null) ...[
        const SizedBox(height: AppSpacing.lg),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: AppColors.card,
            border: Border.all(color: AppColors.border),
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          ),
          child: Text(
            orderNumber,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppColors.foreground,
            ),
          ),
        ),
      ],
      if (estimated != null) ...[
        const SizedBox(height: AppSpacing.sm),
        Text(
          'Estimated delivery: ${formatDate(estimated)}',
          style: const TextStyle(
            fontSize: 13,
            color: AppColors.mutedForeground,
          ),
        ),
      ],
      const SizedBox(height: AppSpacing.xl),
      if (orderId.isNotEmpty)
        SizedBox(
          width: 220,
          child: AppButton(
            label: 'Track order',
            onPressed: () => context.go(RoutePaths.orderDetail(orderId)),
          ),
        ),
      const SizedBox(height: AppSpacing.sm),
      SizedBox(
        width: 220,
        child: AppButton(
          label: 'Continue shopping',
          outlined: true,
          onPressed: () => context.go(RoutePaths.home),
        ),
      ),
    ],
  );
}
