import 'dart:async';

import 'package:cuddlehug_app/core/network/api_exception.dart';
import 'package:cuddlehug_app/core/theme/colors.dart';
import 'package:cuddlehug_app/core/theme/spacing.dart';
import 'package:cuddlehug_app/core/widgets/app_button.dart';
import 'package:cuddlehug_app/core/widgets/app_text_field.dart';
import 'package:cuddlehug_app/core/widgets/wide_body.dart';
import 'package:cuddlehug_app/features/account/application/profile_controller.dart';
import 'package:cuddlehug_app/features/auth/presentation/validators.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Change password (`/profile/password`, protected).
///
/// Mirrors the backend rules: new password 8–72 chars with a letter and a
/// digit; changing it revokes every refresh token (other sessions sign out).
class ChangePasswordScreen extends ConsumerStatefulWidget {
  const new({super.key});

  @override
  ConsumerState<ChangePasswordScreen> createState() =>
      _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends ConsumerState<ChangePasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  var _submitting = false;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _submitting = true);
    try {
      await ref
          .read(profileProvider.notifier)
          .changePassword(
            currentPassword: _current.text,
            newPassword: _next.text,
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(const SnackBar(content: Text('Password changed')));
      context.pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(e.message)));
    } on Object {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(content: Text('Could not change your password')),
        );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  String? _confirmValidator(String? value) {
    if (value == null || value.isEmpty) return 'Confirm your new password';
    if (value != _next.text) return 'Passwords do not match';
    return null;
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Change password')),
    body: WideBody(
      child: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          const Text(
            'Changing your password signs you out on other devices.',
            style: TextStyle(color: AppColors.mutedForeground),
          ),
          const SizedBox(height: AppSpacing.lg),
          Form(
            key: _formKey,
            autovalidateMode: AutovalidateMode.onUserInteraction,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                AppTextField(
                  controller: _current,
                  label: 'Current password',
                  obscureText: true,
                  textInputAction: TextInputAction.next,
                  autofillHints: const [AutofillHints.password],
                  validator: validateRequiredPassword,
                ),
                const SizedBox(height: AppSpacing.md),
                AppTextField(
                  controller: _next,
                  label: 'New password',
                  obscureText: true,
                  textInputAction: TextInputAction.next,
                  validator: validateNewPassword,
                ),
                const SizedBox(height: AppSpacing.md),
                AppTextField(
                  controller: _confirm,
                  label: 'Confirm new password',
                  obscureText: true,
                  textInputAction: TextInputAction.done,
                  onFieldSubmitted: (_) => unawaited(_submit()),
                  validator: _confirmValidator,
                ),
                const SizedBox(height: AppSpacing.lg),
                AppButton(
                  label: 'Change password',
                  loading: _submitting,
                  onPressed: _submit,
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}
