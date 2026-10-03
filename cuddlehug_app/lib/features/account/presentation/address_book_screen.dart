import 'dart:async';

import 'package:cuddlehug_app/core/routing/route_paths.dart';
import 'package:cuddlehug_app/core/theme/colors.dart';
import 'package:cuddlehug_app/core/theme/spacing.dart';
import 'package:cuddlehug_app/core/widgets/empty_state.dart';
import 'package:cuddlehug_app/core/widgets/error_view.dart';
import 'package:cuddlehug_app/core/widgets/skeleton_box.dart';
import 'package:cuddlehug_app/core/widgets/wide_body.dart';
import 'package:cuddlehug_app/features/account/application/addresses_controller.dart';
import 'package:cuddlehug_app/features/account/data/models/address.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Saved addresses list (`/addresses`, protected). Tapping a row makes it
/// the default delivery address.
class AddressBookScreen extends ConsumerWidget {
  const new({super.key});

  Future<void> _confirmDelete(
    BuildContext context,
    WidgetRef ref,
    Address address,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete address?'),
        content: Text('Remove ${address.label} from your saved addresses?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text(
              'Delete',
              style: TextStyle(color: AppColors.destructive),
            ),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    try {
      await ref.read(addressesProvider.notifier).remove(address.id!);
    } on Object {
      // State carries the error and the listener below shows it.
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(addressesProvider);
    ref.listen(addressesProvider.select((s) => s.error), (previous, error) {
      if (error == null || previous == error) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(content: Text('Could not update your addresses')),
        );
    });

    return Scaffold(
      appBar: AppBar(title: const Text('Addresses')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push(RoutePaths.addressNew),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Add address'),
      ),
      body: WideBody(
        child: _Body(state: state, onConfirmDelete: _confirmDelete),
      ),
    );
  }
}

class _Body extends ConsumerWidget {
  const new({required this.state, required this.onConfirmDelete});

  final AddressesState state;
  final Future<void> Function(BuildContext, WidgetRef, Address)
      onConfirmDelete;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (state.loading && state.items.isEmpty) {
      return ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          for (var i = 0; i < 3; i++)
            const Padding(
              padding: EdgeInsets.only(bottom: AppSpacing.md),
              child: SkeletonBox(width: double.infinity, height: 84),
            ),
        ],
      );
    }
    if (state.error != null && state.items.isEmpty) {
      return ErrorView(
        error: state.error,
        onRetry: () => unawaited(
          ref.read(addressesProvider.notifier).load(),
        ),
      );
    }
    if (state.isEmpty) {
      return EmptyState(
        icon: Icons.location_on_outlined,
        title: 'No saved addresses',
        message: 'Add a delivery address to speed through checkout.',
        actionLabel: 'Add address',
        onAction: () => context.push(RoutePaths.addressNew),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.lg,
        96,
      ),
      itemCount: state.items.length,
      separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.md),
      itemBuilder: (context, index) => _AddressCard(
        address: state.items[index],
        busy: state.busyId == state.items[index].id,
        onConfirmDelete: onConfirmDelete,
      ),
    );
  }
}

class _AddressCard extends ConsumerWidget {
  const new({
    required this.address,
    required this.busy,
    required this.onConfirmDelete,
  });

  final Address address;
  final bool busy;
  final Future<void> Function(BuildContext, WidgetRef, Address)
      onConfirmDelete;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = ref.read(addressesProvider.notifier);
    return InkWell(
      borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
      onTap: busy || address.isDefault
          ? null
          : () => controller.setDefault(address.id!),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: AppColors.card,
          border: Border.all(
            color: address.isDefault ? AppColors.primary : AppColors.border,
            width: address.isDefault ? 1.5 : 1,
          ),
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        address.label,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.foreground,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      if (address.isDefault)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.accent,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: const Text(
                            'Default',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: AppColors.onAccent,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    address.fullName,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.foreground,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    address.singleLine,
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.mutedForeground,
                      height: 1.35,
                    ),
                  ),
                  Text(
                    address.fullLabel,
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.mutedForeground,
                      height: 1.35,
                    ),
                  ),
                  Text(
                    address.phone,
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.mutedForeground,
                    ),
                  ),
                ],
              ),
            ),
            PopupMenuButton<String>(
              onSelected: (action) async {
                switch (action) {
                  case 'edit':
                    await context.push(
                      '${RoutePaths.addresses}/${address.id}',
                    );
                  case 'default':
                    try {
                      await controller.setDefault(address.id!);
                    } on Object {
                      // Listener surfaces the failure.
                    }
                  case 'delete':
                    await onConfirmDelete(context, ref, address);
                }
              },
              itemBuilder: (_) => [
                if (!address.isDefault)
                  const PopupMenuItem(
                    value: 'default',
                    child: Text('Set as default'),
                  ),
                const PopupMenuItem(value: 'edit', child: Text('Edit')),
                const PopupMenuItem(
                  value: 'delete',
                  child: Text(
                    'Delete',
                    style: TextStyle(color: AppColors.destructive),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
