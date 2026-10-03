import 'package:cuddlehug_app/core/network/api_exception.dart';
import 'package:cuddlehug_app/core/theme/colors.dart';
import 'package:cuddlehug_app/core/widgets/app_button.dart';
import 'package:flutter/material.dart';

/// Full-surface error state with a retry action (plan §16 states).
class ErrorView extends StatelessWidget {
  const new({
    required this.onRetry,
    super.key,
    this.error,
    this.title = 'Something went wrong',
  });

  final Object? error;
  final String title;
  final VoidCallback? onRetry;

  String get _message {
    final current = error;
    if (current is ApiException) return current.message;
    if (current != null) return current.toString();
    return 'Please check your connection and try again.';
  }

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.cloud_off_rounded,
                size: 56,
                color: AppColors.mutedForeground,
              ),
              const SizedBox(height: 16),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: AppColors.foreground,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                _message,
                style: const TextStyle(
                  fontSize: 14,
                  color: AppColors.mutedForeground,
                  height: 1.4,
                ),
                textAlign: TextAlign.center,
              ),
              if (onRetry != null) ...[
                const SizedBox(height: 24),
                AppButton(label: 'Try again', onPressed: onRetry),
              ],
            ],
          ),
        ),
      );
}
