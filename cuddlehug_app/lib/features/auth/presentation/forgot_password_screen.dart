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

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const new({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  bool _loading = false;
  String? _error;
  bool _sent = false;
  String? _devToken;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _error = null);
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _loading = true);
    try {
      final result = await ref
          .read(authControllerProvider.notifier)
          .forgotPassword(_email.text.trim());
      if (mounted) {
        setState(() {
          _sent = true;
          _devToken = result['devToken'] as String?;
        });
      }
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Reset password')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: _sent ? _sentView() : _formView(),
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
          'Forgot your password?',
          style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: AppSpacing.xs),
        const Text(
          'Enter the email you signed up with and we will send you a reset link.',
          style: TextStyle(color: AppColors.mutedForeground),
        ),
        const SizedBox(height: AppSpacing.lg),
        if (_error != null) ...[
          AuthErrorBanner(message: _error!),
          const SizedBox(height: AppSpacing.md),
        ],
        AppTextField(
          label: 'Email',
          controller: _email,
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.done,
          autofillHints: const [AutofillHints.email],
          validator: validateEmail,
          onFieldSubmitted: (_) => _submit(),
        ),
        const SizedBox(height: AppSpacing.lg),
        AppButton(
          label: 'Send reset link',
          loading: _loading,
          onPressed: _submit,
        ),
        TextButton(
          onPressed: _loading ? null : () => context.pop(),
          child: const Text('Back to sign in'),
        ),
      ],
    ),
  );

  Widget _sentView() => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const Icon(
        Icons.mark_email_read_outlined,
        size: 56,
        color: AppColors.primary,
      ),
      const SizedBox(height: AppSpacing.md),
      const Text(
        'Check your inbox',
        textAlign: TextAlign.center,
        style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800),
      ),
      const SizedBox(height: AppSpacing.sm),
      const Text(
        'If that email exists, a reset link is on its way. Open the link on this device to set a new password.',
        textAlign: TextAlign.center,
        style: TextStyle(color: AppColors.mutedForeground),
      ),
      if (_devToken != null) ...[
        const SizedBox(height: AppSpacing.md),
        Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: AppColors.cardMuted,
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          ),
          child: Column(
            children: [
              const Text(
                'Dev only — no mail server here:',
                style: TextStyle(
                  fontSize: 12,
                  color: AppColors.mutedForeground,
                ),
              ),
              const SizedBox(height: 4),
              SelectableText(
                '/reset-password?token=$_devToken',
                style: const TextStyle(fontSize: 12, fontFamily: 'monospace'),
              ),
            ],
          ),
        ),
      ],
      const SizedBox(height: AppSpacing.lg),
      AppButton(
        label: 'Back to sign in',
        onPressed: () => context.go(RoutePaths.login),
      ),
    ],
  );
}
