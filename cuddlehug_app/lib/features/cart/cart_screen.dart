import 'dart:async';

import 'package:cuddlehug_app/core/network/api_exception.dart';
import 'package:cuddlehug_app/core/routing/responsive.dart';
import 'package:cuddlehug_app/core/routing/route_paths.dart';
import 'package:cuddlehug_app/core/theme/colors.dart';
import 'package:cuddlehug_app/core/theme/spacing.dart';
import 'package:cuddlehug_app/core/utils/formatters.dart';
import 'package:cuddlehug_app/core/widgets/app_button.dart';
import 'package:cuddlehug_app/core/widgets/empty_state.dart';
import 'package:cuddlehug_app/core/widgets/error_view.dart';
import 'package:cuddlehug_app/core/widgets/network_image_view.dart';
import 'package:cuddlehug_app/core/widgets/price_text.dart';
import 'package:cuddlehug_app/core/widgets/skeleton_box.dart';
import 'package:cuddlehug_app/features/cart/application/cart_controller.dart';
import 'package:cuddlehug_app/features/cart/data/models/cart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Cart tab (plan §6): works for guests (`ch_sid`) and signed-in users.
/// All pricing comes from the server-computed summary — never recomputed
/// client-side.
class CartScreen extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(cartProvider);
    ref.listen(cartProvider.select((s) => s.error), (previous, error) {
      if (error == null || previous == error) return;
      final message = error is ApiException
          ? error.message
          : 'Could not update your cart';
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(message)));
      ref.read(cartProvider.notifier).clearError();
    });

    final cart = state.cart;
    return Scaffold(
      appBar: AppBar(title: const Text('Cart')),
      body: _Body(state: state),
      bottomNavigationBar: cart == null || cart.isEmpty
          ? null
          : _CheckoutBar(cart: cart),
    );
  }
}

class _Body extends ConsumerWidget {
  const new({required this.state});

  final CartState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cart = state.cart;
    if (cart == null) {
      if (state.error != null) {
        return ErrorView(
          error: state.error,
          onRetry: () =>
              unawaited(ref.read(cartProvider.notifier).load(force: true)),
        );
      }
      return const _CartSkeleton();
    }
    if (cart.isEmpty) {
      return EmptyState(
        icon: Icons.shopping_bag_outlined,
        title: 'Your cart is empty',
        message: 'Add soft companions and they will show up here.',
        actionLabel: 'Start shopping',
        onAction: () => context.go(RoutePaths.shop),
      );
    }
    final lines = ListView(
      padding: const EdgeInsets.only(bottom: AppSpacing.lg),
      children: [
        for (final item in cart.items) _CartLineTile(item: item),
        _CouponCard(cart: cart),
      ],
    );
    final summary = _SummaryCard(summary: cart.summary);
    // Plan §14.2: expanded tablets get lines (1fr) + sticky summary (340dp).
    if (Breakpoints.isExpanded(context)) {
      return Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(child: lines),
          Container(
            width: 340,
            decoration: const BoxDecoration(
              border: Border(left: BorderSide(color: AppColors.border)),
            ),
            child: ListView(
              padding: const EdgeInsets.only(bottom: AppSpacing.lg),
              children: [summary],
            ),
          ),
        ],
      );
    }
    return ListView(
      padding: const EdgeInsets.only(bottom: AppSpacing.lg),
      children: [
        for (final item in cart.items) _CartLineTile(item: item),
        _CouponCard(cart: cart),
        summary,
      ],
    );
  }
}

class _CartLineTile extends ConsumerWidget {
  const new({required this.item});

  final CartItem item;

  Future<void> _run(Future<Cart> Function() run) async {
    try {
      await run();
    } on Object {
      // Errors surface through the listener in [CartScreen].
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cartState = ref.watch(cartProvider);
    final busy = cartState.isBusy(item.variantId);
    final canIncrease = item.quantity < item.maxQuantity;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.lg,
        0,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            child: NetworkImageView(
              url: item.product.image,
              width: 76,
              height: 76,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.product.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.foreground,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  item.variant.label,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.mutedForeground,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Row(
                  children: [
                    PriceText(
                      price: item.variant.priceMoney,
                      mrp: item.variant.mrpMoney,
                      fontSize: 14,
                      showDiscount: false,
                    ),
                    const Spacer(),
                    _QuantityStepper(
                      item: item,
                      busy: busy,
                      canIncrease: canIncrease,
                      onChanged: (quantity) => unawaited(
                        _run(
                          () => ref
                              .read(cartProvider.notifier)
                              .updateQuantity(item.variantId, quantity),
                        ),
                      ),
                      onRemove: () => unawaited(
                        _run(
                          () => ref
                              .read(cartProvider.notifier)
                              .removeItem(item.id, variantId: item.variantId),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _QuantityStepper extends StatelessWidget {
  const new({
    required this.item,
    required this.busy,
    required this.canIncrease,
    required this.onChanged,
    required this.onRemove,
  });

  final CartItem item;
  final bool busy;
  final bool canIncrease;
  final ValueChanged<int> onChanged;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final atMin = item.quantity <= 1;
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _StepButton(
            icon: atMin ? Icons.delete_outline_rounded : Icons.remove_rounded,
            enabled: !busy,
            onTap: atMin ? onRemove : () => onChanged(item.quantity - 1),
          ),
          SizedBox(
            width: 28,
            child: busy
                ? const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(
                    '${item.quantity}',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
          ),
          _StepButton(
            icon: Icons.add_rounded,
            enabled: !busy && canIncrease,
            onTap: () => onChanged(item.quantity + 1),
          ),
        ],
      ),
    );
  }
}

class _StepButton extends StatelessWidget {
  const new({required this.icon, required this.enabled, required this.onTap});

  final IconData icon;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: enabled ? onTap : null,
    child: Padding(
      padding: const EdgeInsets.all(6),
      child: Icon(
        icon,
        size: 18,
        color: enabled ? AppColors.foreground : AppColors.mutedForeground,
      ),
    ),
  );
}

class _CouponCard extends ConsumerStatefulWidget {
  const new({required this.cart});

  final Cart cart;

  @override
  ConsumerState<_CouponCard> createState() => _CouponCardState();
}

class _CouponCardState extends ConsumerState<_CouponCard> {
  final TextEditingController _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _apply() async {
    final code = _controller.text.trim();
    if (code.isEmpty) return;
    FocusScope.of(context).unfocus();
    try {
      await ref.read(cartProvider.notifier).applyCoupon(code);
      _controller.clear();
      if (mounted) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(const SnackBar(content: Text('Coupon applied')));
      }
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(content: Text(error.message)));
      }
    } on Object {
      if (mounted) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(
            const SnackBar(content: Text('Could not apply the coupon')),
          );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final coupon = widget.cart.coupon;
    final couponBusy = ref.watch(cartProvider.select((s) => s.couponBusy));
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.lg,
        0,
      ),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: AppColors.card,
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        ),
        child: coupon != null
            ? Row(
                children: [
                  const Icon(
                    Icons.local_offer_rounded,
                    size: 18,
                    color: AppColors.primary,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          coupon.code,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.foreground,
                          ),
                        ),
                        if (coupon.description != null &&
                            coupon.description!.isNotEmpty)
                          Text(
                            coupon.description!,
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.mutedForeground,
                            ),
                          ),
                      ],
                    ),
                  ),
                  Text(
                    '- ${formatMoney(coupon.discountMoney)}',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppColors.success,
                    ),
                  ),
                  IconButton(
                    tooltip: 'Remove coupon',
                    visualDensity: VisualDensity.compact,
                    onPressed: couponBusy
                        ? null
                        : () async {
                            try {
                              await ref
                                  .read(cartProvider.notifier)
                                  .removeCoupon();
                            } on Object {
                              // Listener shows the failure.
                            }
                          },
                    icon: const Icon(Icons.close_rounded, size: 18),
                  ),
                ],
              )
            : Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      textCapitalization: TextCapitalization.characters,
                      style: const TextStyle(fontSize: 14),
                      decoration: const InputDecoration(
                        isDense: true,
                        hintText: 'Coupon code',
                        prefixIcon: Icon(Icons.local_offer_outlined, size: 18),
                      ),
                      onSubmitted: (_) => _apply(),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  SizedBox(
                    width: 84,
                    child: AppButton(
                      label: 'Apply',
                      loading: couponBusy,
                      onPressed: _apply,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const new({required this.summary});

  final CartSummary summary;

  @override
  Widget build(BuildContext context) {
    final savings = summary.savingsMoney;
    final coupon = summary.couponMoney;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.lg,
        0,
      ),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: AppColors.card,
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        ),
        child: Column(
          children: [
            _row('Subtotal', formatMoney(summary.subtotalMoney)),
            if (!savings.isZero)
              _row(
                'Product savings',
                '- ${formatMoney(savings)}',
                color: AppColors.success,
              ),
            if (!coupon.isZero)
              _row(
                'Coupon discount',
                '- ${formatMoney(coupon)}',
                color: AppColors.success,
              ),
            _row(
              'Shipping',
              summary.freeShippingUnlocked
                  ? 'FREE'
                  : formatMoney(summary.shippingMoney),
              color: summary.freeShippingUnlocked ? AppColors.success : null,
            ),
            _row('Tax', formatMoney(summary.taxMoney)),
            const Padding(
              padding: EdgeInsets.symmetric(vertical: AppSpacing.xs),
              child: Divider(height: 1),
            ),
            _row('Total', formatMoney(summary.totalMoney), bold: true),
          ],
        ),
      ),
    );
  }

  Widget _row(
    String label,
    String value, {
    Color? color,
    bool bold = false,
  }) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: TextStyle(
              fontSize: bold ? 15 : 13,
              fontWeight: bold ? FontWeight.w700 : FontWeight.w400,
              color: bold ? AppColors.foreground : AppColors.mutedForeground,
            ),
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: bold ? 16 : 13,
            fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
            color:
                color ?? (bold ? AppColors.foreground : AppColors.foreground),
          ),
        ),
      ],
    ),
  );
}

class _CheckoutBar extends StatelessWidget {
  const new({required this.cart});

  final Cart cart;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.fromLTRB(
      AppSpacing.lg,
      AppSpacing.md,
      AppSpacing.lg,
      AppSpacing.sm,
    ),
    decoration: const BoxDecoration(
      color: AppColors.card,
      border: Border(top: BorderSide(color: AppColors.border)),
    ),
    child: SafeArea(
      top: false,
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '${cart.itemCount} item${cart.itemCount == 1 ? '' : 's'}',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.mutedForeground,
                  ),
                ),
                Text(
                  formatMoney(cart.summary.totalMoney),
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: AppColors.foreground,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          SizedBox(
            width: 180,
            child: AppButton(
              label: 'Checkout',
              onPressed: () => context.push(RoutePaths.checkout),
            ),
          ),
        ],
      ),
    ),
  );
}

class _CartSkeleton extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(AppSpacing.lg),
    children: [
      for (var i = 0; i < 4; i++)
        const Padding(
          padding: EdgeInsets.only(bottom: AppSpacing.lg),
          child: Row(
            children: [
              SkeletonBox(width: 76, height: 76),
              SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SkeletonBox(width: double.infinity, height: 14),
                    SizedBox(height: 8),
                    SkeletonBox(width: 120, height: 12),
                    SizedBox(height: 8),
                    SkeletonBox(width: 80, height: 12),
                  ],
                ),
              ),
            ],
          ),
        ),
    ],
  );
}
