import 'dart:async';

import 'package:cuddlehug_app/core/data/store_settings.dart';
import 'package:cuddlehug_app/core/network/api_exception.dart';
import 'package:cuddlehug_app/core/routing/responsive.dart';
import 'package:cuddlehug_app/core/routing/route_paths.dart';
import 'package:cuddlehug_app/core/theme/colors.dart';
import 'package:cuddlehug_app/core/theme/spacing.dart';
import 'package:cuddlehug_app/core/utils/formatters.dart';
import 'package:cuddlehug_app/core/widgets/app_button.dart';
import 'package:cuddlehug_app/features/account/application/addresses_controller.dart';
import 'package:cuddlehug_app/features/account/data/models/address.dart';
import 'package:cuddlehug_app/features/auth/application/auth_controller.dart';
import 'package:cuddlehug_app/features/cart/application/cart_controller.dart';
import 'package:cuddlehug_app/features/checkout/application/checkout_controller.dart';
import 'package:cuddlehug_app/features/checkout/data/models/payment_intent.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

/// Checkout (plan §7): address picker, payment method (driven by public
/// settings), server-priced summary, then the order/payment handoff.
/// The Razorpay sheet opens from here; the controller owns the state.
class CheckoutScreen extends ConsumerStatefulWidget {
  const new({super.key});

  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  Razorpay? _razorpay;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(checkoutProvider.notifier).reset();
    });
  }

  @override
  void dispose() {
    _razorpay?.clear();
    super.dispose();
  }

  void _openRazorpay(PaymentIntent intent) {
    final controller = ref.read(checkoutProvider.notifier);
    final checkout = ref.read(checkoutProvider);
    final razorpay = (_razorpay ??= Razorpay())
      ..on(Razorpay.EVENT_PAYMENT_SUCCESS, (PaymentSuccessResponse response) {
        final orderId = response.orderId;
        final paymentId = response.paymentId;
        final signature = response.signature;
        if (orderId == null || paymentId == null || signature == null) {
          controller.cancelPayment();
          return;
        }
        unawaited(
          controller.verifyPayment(
            PaymentVerifyPayload(
              razorpayOrderId: orderId,
              razorpayPaymentId: paymentId,
              razorpaySignature: signature,
            ),
          ),
        );
      })
      ..on(Razorpay.EVENT_PAYMENT_ERROR, (PaymentFailureResponse response) {
        controller.cancelPayment();
      })
      ..on(Razorpay.EVENT_EXTERNAL_WALLET, (ExternalWalletResponse response) {
        controller.cancelPayment();
      });

    final user = ref.read(authControllerProvider).displayUser;
    final address = checkout.address;
    razorpay.open(<String, dynamic>{
      'key': intent.keyId,
      'amount': intent.amount,
      'currency': intent.currency,
      'name': 'CuddleHug',
      'description': 'Order ${intent.orderNumber}',
      'order_id': intent.razorpayOrderId,
      'prefill': <String, String>{
        'name': address?.fullName ?? user?.fullName ?? '',
        'contact': address?.phone ?? user?.phone ?? '',
        'email': user?.email ?? '',
      },
      'theme': <String, String>{'color': '#e0674f'},
    });
  }

  void _finish(String orderId) {
    context.go('${RoutePaths.orderConfirmation}?orderId=$orderId');
  }

  @override
  Widget build(BuildContext context) {
    final checkout = ref.watch(checkoutProvider);
    final addresses = ref.watch(addressesProvider);
    final settings = ref.watch(storeSettingsProvider).value;
    final cart = ref.watch(cartProvider).cart;

    ref.listen(checkoutProvider, (previous, next) {
      if (next.pendingIntent != null && previous?.pendingIntent == null) {
        _openRazorpay(next.pendingIntent!);
      }
      if (next.completedOrder != null && previous?.completedOrder == null) {
        _finish(next.completedOrder!.id);
      }
      if (next.stage == CheckoutStage.failed &&
          previous?.stage != CheckoutStage.failed &&
          next.error != null) {
        final error = next.error;
        final message = error is ApiException
            ? error.message
            : 'Checkout failed. Please try again.';
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(content: Text(message)));
      }
    });

    // Preselect the default address once the list lands.
    final defaultAddress = addresses.defaultAddress;
    if (checkout.address == null && defaultAddress != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || ref.read(checkoutProvider).address != null) return;
        ref.read(checkoutProvider.notifier).selectAddress(defaultAddress);
      });
    }

    final codEnabled = settings?.codEnabled ?? true;
    final onlineEnabled = settings?.razorpayEnabled ?? false;
    final total = cart?.summary.totalMoney;

    final formSections = <Widget>[
      _SectionCard(
        title: 'Delivery address',
        trailing: addresses.items.isEmpty
            ? null
            : TextButton(
                onPressed: () => context.push(RoutePaths.addressNew),
                child: const Text('Add new'),
              ),
        child: addresses.loading && addresses.items.isEmpty
            ? const Padding(
                padding: EdgeInsets.all(AppSpacing.sm),
                child: LinearProgressIndicator(),
              )
            : addresses.items.isEmpty
            ? const Text(
                'Save a delivery address to continue.',
                style: TextStyle(
                  fontSize: 13,
                  color: AppColors.mutedForeground,
                ),
              )
            : Column(
                children: [
                  for (final address in addresses.items)
                    _AddressOption(
                      address: address,
                      selected: checkout.address?.id == address.id,
                      onTap: () => ref
                          .read(checkoutProvider.notifier)
                          .selectAddress(address),
                    ),
                ],
              ),
      ),
      const SizedBox(height: AppSpacing.md),
      _SectionCard(
        title: 'Payment method',
        child: Column(
          children: [
            if (onlineEnabled)
              _MethodOption(
                icon: Icons.account_balance_wallet_outlined,
                title: 'Pay online',
                subtitle: 'Card, UPI, netbanking (Razorpay)',
                selected: checkout.method == PaymentMethod.razorpay,
                onTap: () => ref
                    .read(checkoutProvider.notifier)
                    .selectMethod(PaymentMethod.razorpay),
              ),
            if (onlineEnabled && codEnabled) const Divider(height: 1),
            if (codEnabled)
              _MethodOption(
                icon: Icons.payments_outlined,
                title: 'Cash on delivery',
                subtitle: 'Pay when your order arrives',
                selected: checkout.method == PaymentMethod.cod,
                onTap: () => ref
                    .read(checkoutProvider.notifier)
                    .selectMethod(PaymentMethod.cod),
              ),
          ],
        ),
      ),
    ];

    final summaryCard = cart == null
        ? null
        : _SectionCard(
            title: 'Order summary',
            child: Column(
              children: [
                _row(
                  '${cart.itemCount} item${cart.itemCount == 1 ? '' : 's'}',
                  '',
                ),
                if (cart.coupon != null)
                  _row(
                    'Coupon ${cart.coupon!.code}',
                    '- ${formatMoney(cart.coupon!.discountMoney)}',
                  ),
                _row('Subtotal', formatMoney(cart.summary.subtotalMoney)),
                _row(
                  'Shipping',
                  cart.summary.freeShippingUnlocked
                      ? 'FREE'
                      : formatMoney(cart.summary.shippingMoney),
                ),
                _row('Tax', formatMoney(cart.summary.taxMoney)),
                const Divider(height: 16),
                _row('Total', formatMoney(cart.summary.totalMoney)),
              ],
            ),
          );

    return Scaffold(
      appBar: AppBar(title: const Text('Checkout')),
      // Plan §14.2: expanded tablets keep the sticky order summary (340dp)
      // beside the address + payment sections.
      body: Breakpoints.isExpanded(context) && summaryCard != null
          ? Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.all(AppSpacing.lg),
                    children: [...formSections, const SizedBox(height: 96)],
                  ),
                ),
                Container(
                  width: 340,
                  decoration: const BoxDecoration(
                    border: Border(left: BorderSide(color: AppColors.border)),
                  ),
                  child: ListView(
                    padding: const EdgeInsets.all(AppSpacing.lg),
                    children: [summaryCard],
                  ),
                ),
              ],
            )
          : ListView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              children: [
                ...formSections,
                if (summaryCard != null) ...[
                  const SizedBox(height: AppSpacing.md),
                  summaryCard,
                ],
                const SizedBox(height: 96),
              ],
            ),
      bottomNavigationBar: SafeArea(
        child: Container(
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
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'Total',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.mutedForeground,
                      ),
                    ),
                    Text(
                      total == null ? '—' : formatMoney(total),
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
                child: Builder(
                  builder: (context) {
                    final retryable =
                        checkout.stage == CheckoutStage.failed &&
                        checkout.placedOrder != null;
                    return AppButton(
                      label: retryable
                          ? 'Retry payment'
                          : checkout.method == PaymentMethod.cod
                          ? 'Place order'
                          : 'Pay now',
                      loading: checkout.busy,
                      onPressed: checkout.canPlaceOrder || retryable
                          ? () {
                              final controller = ref.read(
                                checkoutProvider.notifier,
                              );
                              if (retryable) {
                                unawaited(controller.retryPayment());
                              } else {
                                unawaited(controller.placeOrder());
                              }
                            }
                          : null,
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _row(String label, String value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 13,
              color: AppColors.mutedForeground,
            ),
          ),
        ),
        Text(
          value,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: AppColors.foreground,
          ),
        ),
      ],
    ),
  );
}

class _SectionCard extends StatelessWidget {
  const new({required this.title, required this.child, this.trailing});

  final String title;
  final Widget child;
  final Widget? trailing;

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
        Row(
          children: [
            Expanded(
              child: Text(
                title,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: AppColors.foreground,
                ),
              ),
            ),
            ?trailing,
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        child,
      ],
    ),
  );
}

class _AddressOption extends StatelessWidget {
  const new({
    required this.address,
    required this.selected,
    required this.onTap,
  });

  final Address address;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            selected
                ? Icons.radio_button_checked_rounded
                : Icons.radio_button_off_rounded,
            size: 20,
            color: selected ? AppColors.primary : AppColors.mutedForeground,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
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
                    fontSize: 12,
                    color: AppColors.mutedForeground,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

class _MethodOption extends StatelessWidget {
  const new({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(
            selected
                ? Icons.radio_button_checked_rounded
                : Icons.radio_button_off_rounded,
            size: 20,
            color: selected ? AppColors.primary : AppColors.mutedForeground,
          ),
          const SizedBox(width: AppSpacing.sm),
          Icon(icon, size: 20, color: AppColors.onAccent),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.foreground,
                  ),
                ),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.mutedForeground,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}
