import 'package:cuddlehug_app/core/routing/responsive.dart';
import 'package:cuddlehug_app/core/theme/colors.dart';
import 'package:cuddlehug_app/core/theme/spacing.dart';
import 'package:cuddlehug_app/core/utils/formatters.dart';
import 'package:cuddlehug_app/core/widgets/error_view.dart';
import 'package:cuddlehug_app/core/widgets/network_image_view.dart';
import 'package:cuddlehug_app/core/widgets/skeleton_box.dart';
import 'package:cuddlehug_app/features/account/data/models/address.dart';
import 'package:cuddlehug_app/features/orders/application/orders_controller.dart';
import 'package:cuddlehug_app/features/orders/data/models/order.dart';
import 'package:cuddlehug_app/features/orders/presentation/order_status.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Single order (`/orders/:id`, protected): status timeline, items,
/// payment, address and totals.
class OrderDetailScreen extends ConsumerWidget {
  const new({required this.orderId, super.key});

  final String orderId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(orderDetailProvider(orderId));
    return Scaffold(
      appBar: AppBar(title: const Text('Order details')),
      body: detail.when(
        loading: () => ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: const [
            SkeletonBox(width: double.infinity, height: 120),
            SizedBox(height: AppSpacing.md),
            SkeletonBox(width: double.infinity, height: 200),
            SizedBox(height: AppSpacing.md),
            SkeletonBox(width: double.infinity, height: 140),
          ],
        ),
        error: (error, _) => ErrorView(
          error: error,
          onRetry: () => ref.invalidate(orderDetailProvider(orderId)),
        ),
        data: (order) {
          // Plan §14.2: expanded tablets split status/timeline left and
          // items + totals + payment + address right.
          final left = <Widget>[
            _StatusCard(order: order),
            if (order.trackingNumber != null) ...[
              const SizedBox(height: AppSpacing.md),
              _TrackingCard(order: order),
            ],
          ];
          final right = <Widget>[
            _ItemsCard(order: order),
            const SizedBox(height: AppSpacing.md),
            _TotalsCard(order: order),
            const SizedBox(height: AppSpacing.md),
            _PaymentCard(order: order),
            if (order.shippingAddress != null) ...[
              const SizedBox(height: AppSpacing.md),
              _AddressCard(address: order.shippingAddress!),
            ],
            const SizedBox(height: AppSpacing.xxl),
          ];
          if (Breakpoints.isExpanded(context)) {
            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.all(AppSpacing.lg),
                    children: left,
                  ),
                ),
                Container(
                  width: 420,
                  decoration: const BoxDecoration(
                    border: Border(left: BorderSide(color: AppColors.border)),
                  ),
                  child: ListView(
                    padding: const EdgeInsets.all(AppSpacing.lg),
                    children: right,
                  ),
                ),
              ],
            );
          }
          return ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: [
              ...left,
              const SizedBox(height: AppSpacing.md),
              ...right,
            ],
          );
        },
      ),
    );
  }
}

class _Card extends StatelessWidget {
  const new({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(AppSpacing.md),
    decoration: BoxDecoration(
      color: AppColors.card,
      border: Border.all(color: AppColors.border),
      borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: AppColors.foreground,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        ...children,
      ],
    ),
  );
}

class _StatusCard extends StatelessWidget {
  const new({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    final color = orderStatusColor(order.status);
    return _Card(
      title: 'Status',
      children: [
        Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                orderStatusLabel(order.status),
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: color,
                ),
              ),
            ),
            const Spacer(),
            Text(
              order.orderNumber,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppColors.mutedForeground,
              ),
            ),
          ],
        ),
        if (order.estimatedDelivery != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Estimated delivery: ${formatDate(order.estimatedDelivery!)}',
            style: const TextStyle(
              fontSize: 13,
              color: AppColors.mutedForeground,
            ),
          ),
        ],
        if (order.cancelReason != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Reason: ${order.cancelReason}',
            style: const TextStyle(fontSize: 13, color: AppColors.destructive),
          ),
        ],
        const SizedBox(height: AppSpacing.md),
        for (final (index, entry) in order.history.indexed) ...[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Column(
                children: [
                  Container(
                    width: 10,
                    height: 10,
                    margin: const EdgeInsets.only(top: 4),
                    decoration: BoxDecoration(
                      color: index == order.history.length - 1
                          ? color
                          : AppColors.border,
                      shape: BoxShape.circle,
                    ),
                  ),
                  if (index != order.history.length - 1)
                    Container(width: 2, height: 34, color: AppColors.border),
                ],
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        orderStatusLabel(entry.status),
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.foreground,
                        ),
                      ),
                      Text(
                        '${entry.note ?? ''} · ${formatDateTime(entry.createdAt)}'
                            .replaceFirst(' · ', ''),
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.mutedForeground,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

class _TrackingCard extends StatelessWidget {
  const new({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) => _Card(
    title: 'Tracking',
    children: [
      if (order.courierName != null)
        Text(
          order.courierName!,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: AppColors.foreground,
          ),
        ),
      Text(
        order.trackingNumber!,
        style: const TextStyle(fontSize: 13, color: AppColors.mutedForeground),
      ),
    ],
  );
}

class _ItemsCard extends StatelessWidget {
  const new({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) => _Card(
    title: 'Items',
    children: [
      for (final item in order.items)
        Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                child: NetworkImageView(
                  url: item.imageUrl,
                  width: 52,
                  height: 52,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.productName,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.foreground,
                      ),
                    ),
                    Text(
                      '${item.variantLabel} · Qty ${item.quantity}',
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.mutedForeground,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                formatMoney(item.lineTotalMoney),
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.foreground,
                ),
              ),
            ],
          ),
        ),
    ],
  );
}

class _TotalsCard extends StatelessWidget {
  const new({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) => _Card(
    title: 'Summary',
    children: [
      _row('Subtotal', formatMoney(order.subtotalMoney)),
      if (!order.discountMoney.isZero)
        _row(
          'Discount${order.couponCode != null ? ' (${order.couponCode})' : ''}',
          '- ${formatMoney(order.discountMoney)}',
          color: AppColors.success,
        ),
      _row(
        'Shipping',
        order.shippingMoney.isZero ? 'FREE' : formatMoney(order.shippingMoney),
        color: order.shippingMoney.isZero ? AppColors.success : null,
      ),
      _row('Tax', formatMoney(order.taxMoney)),
      const Padding(
        padding: EdgeInsets.symmetric(vertical: AppSpacing.xs),
        child: Divider(height: 1),
      ),
      _row('Total', formatMoney(order.totalMoney), bold: true),
    ],
  );

  Widget _row(String label, String value, {Color? color, bool bold = false}) =>
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  fontSize: bold ? 15 : 13,
                  fontWeight: bold ? FontWeight.w700 : FontWeight.w400,
                  color: bold
                      ? AppColors.foreground
                      : AppColors.mutedForeground,
                ),
              ),
            ),
            Text(
              value,
              style: TextStyle(
                fontSize: bold ? 16 : 13,
                fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
                color: color ?? AppColors.foreground,
              ),
            ),
          ],
        ),
      );
}

class _PaymentCard extends StatelessWidget {
  const new({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    final color = paymentStatusColor(order.paymentStatus);
    return _Card(
      title: 'Payment',
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                order.paymentMethod == 'COD' ? 'Cash on delivery' : 'Razorpay',
                style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.foreground,
                ),
              ),
            ),
            Text(
              order.paymentStatus,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: color,
              ),
            ),
          ],
        ),
        if (order.payment?.providerPaymentId != null)
          Text(
            order.payment!.providerPaymentId!,
            style: const TextStyle(
              fontSize: 12,
              color: AppColors.mutedForeground,
            ),
          ),
      ],
    );
  }
}

class _AddressCard extends StatelessWidget {
  const new({required this.address});

  final Address address;

  @override
  Widget build(BuildContext context) => _Card(
    title: 'Delivery address',
    children: [
      Text(
        '${address.label} · ${address.fullName}',
        style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: AppColors.foreground,
        ),
      ),
      Text(
        '${address.singleLine}, ${address.fullLabel}',
        style: const TextStyle(
          fontSize: 13,
          color: AppColors.mutedForeground,
          height: 1.4,
        ),
      ),
      Text(
        address.phone,
        style: const TextStyle(fontSize: 13, color: AppColors.mutedForeground),
      ),
    ],
  );
}
