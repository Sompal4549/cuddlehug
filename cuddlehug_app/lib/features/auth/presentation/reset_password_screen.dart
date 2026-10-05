import 'package:cuddlehug_app/core/network/api_exception.dart';
import 'package:cuddlehug_app/core/routing/route_paths.dart';
import 'package:cuddlehug_app/core/theme/colors.dart';
import 'package:cuddlehug_app/core/theme/spacing.dart';
import 'package:cuddlehug_app/core/widgets/app_button.dart';
import 'package:cuddlehug_app/core/widgets/app_text_field.dart';
import 'package:cuddlehug_app/features/auth/application/auth_controller.dart';
import 'package:cuddlehug_app/features/auth/presentation/login_screen.dart';
import 'package:cuddlehug_app/features/auth/presentation/validators.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// `POST /auth/reset-password` with the token emailed to the user (plan §5).
/// Reached via the emailed link once deep links are wired (release sprint).
class ResetPasswordScreen extends ConsumerStatefulWidget {
  const new({required this.token, super.key});

  final String token;

  @override
  ConsumerState<ResetPasswordScreen> createState() =>
      _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends ConsumerState<ResetPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _loading = false;
  String? _error;
  bool _done = false;

  @override
  void dispose() {
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _error = null);
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _loading = true);
    try {
      await ref
          .read(authControllerProvider.notifier)
          .resetPassword(token: widget.token, password: _password.text);
      if (mounted) setState(() => _done = true);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Set new password')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: _done ? _doneView() : _formView(),
      ),
    );
  }

  Widget _formView() => Form(
    key: _formKey,
    autovalidateMode: AutovalidateMode.onUserInteraction,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Choose a new password',
          style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: AppSpacing.lg),
        if (_error != null) ...[
          AuthErrorBanner(message: _error!),
          const SizedBox(height: AppSpacing.md),
        ],
        AppTextField(
          label: 'New password',
          controller: _password,
          obscureText: true,
          autofillHints: const [AutofillHints.newPassword],
          validator: validateNewPassword,
        ),
        const SizedBox(height: AppSpacing.md),
        AppTextField(
          label: 'Confirm password',
          controller: _confirm,
          obscureText: true,
          textInputAction: TextInputAction.done,
          validator: (value) {
            if (value != _password.text) return 'Passwords do not match';
            return null;
          },
          onFieldSubmitted: (_) => _submit(),
        ),
        const SizedBox(height: AppSpacing.lg),
        AppButton(
          label: 'Update password',
          loading: _loading,
          onPressed: _submit,
        ),
      ],
    ),
  );

  Widget _doneView() => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const Icon(
        Icons.check_circle_outline,
        size: 56,
        color: AppColors.success,
      ),
      const SizedBox(height: AppSpacing.md),
      const Text(
        'Password updated',
        textAlign: TextAlign.center,
        style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800),
      ),
      const SizedBox(height: AppSpacing.sm),
      const Text(
        'For your security, all other sessions were signed out. Please sign in again.',
        textAlign: TextAlign.center,
        style: TextStyle(color: AppColors.mutedForeground),
      ),
      const SizedBox(height: AppSpacing.lg),
      AppButton(
        label: 'Go to sign in',
        onPressed: () => context.go(RoutePaths.login),
      ),
    ],
  );
}
