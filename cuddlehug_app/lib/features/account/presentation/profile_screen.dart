import 'package:cuddlehug_app/core/routing/route_paths.dart';
import 'package:cuddlehug_app/core/theme/colors.dart';
import 'package:cuddlehug_app/core/theme/spacing.dart';
import 'package:cuddlehug_app/core/widgets/app_button.dart';
import 'package:cuddlehug_app/core/widgets/app_text_field.dart';
import 'package:cuddlehug_app/core/widgets/error_view.dart';
import 'package:cuddlehug_app/core/widgets/skeleton_box.dart';
import 'package:cuddlehug_app/features/account/application/profile_controller.dart';
import 'package:cuddlehug_app/features/auth/data/models/user.dart';
import 'package:cuddlehug_app/features/auth/presentation/validators.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Profile edit + account status (`/profile`, protected).
class ProfileScreen extends ConsumerStatefulWidget {
  const new({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _firstName;
  late final TextEditingController _lastName;
  late final TextEditingController _phone;
  var _prefilled = false;

  @override
  void initState() {
    super.initState();
    _firstName = TextEditingController();
    _lastName = TextEditingController();
    _phone = TextEditingController();
    _prefill(ref.read(profileProvider).user);
  }

  void _prefill(User? user) {
    if (user == null) return;
    _firstName.text = user.firstName;
    _lastName.text = user.lastName;
    _phone.text = user.phone ?? '';
    _prefilled = true;
  }

  @override
  void dispose() {
    _firstName.dispose();
    _lastName.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    try {
      await ref.read(profileProvider.notifier).update(
            firstName: _firstName.text.trim(),
            lastName: _lastName.text.trim(),
            phone: _phone.text.trim().isEmpty ? null : _phone.text.trim(),
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(const SnackBar(content: Text('Profile updated')));
    } on Object {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(content: Text('Could not save your profile')),
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(profileProvider);
    // Profile may arrive after the first frame (session restore race).
    if (!_prefilled && state.user != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && !_prefilled) _prefill(state.user);
      });
    }

    final profile = state.profile;
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: state.loading && profile == null
          ? const _ProfileSkeleton()
          : state.error != null && profile == null
              ? ErrorView(
                  error: state.error,
                  onRetry: () =>
                      ref.read(profileProvider.notifier).load(),
                )
              : profile == null
                  ? const Center(child: Text('No profile loaded'))
                  : ListView(
                      padding: const EdgeInsets.all(AppSpacing.lg),
                      children: [
                        Row(
                          children: [
                            CircleAvatar(
                              radius: 32,
                              backgroundColor: AppColors.accent,
                              child: Text(
                                '${profile.user.firstName.isNotEmpty ? profile.user.firstName[0] : ''}'
                                '${profile.user.lastName.isNotEmpty ? profile.user.lastName[0] : ''}'
                                    .toUpperCase(),
                                style: const TextStyle(
                                  fontSize: 24,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.onAccent,
                                ),
                              ),
                            ),
                            const SizedBox(width: AppSpacing.md),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '${profile.user.firstName} '
                                    '${profile.user.lastName}',
                                    style: const TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  Text(
                                    profile.user.email,
                                    style: const TextStyle(
                                      color: AppColors.mutedForeground,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.md),
                        Card(
                          child: Padding(
                            padding: const EdgeInsets.all(AppSpacing.md),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceAround,
                              children: [
                                _Stat(
                                  value: '${profile.stats.orders}',
                                  label: 'Orders',
                                ),
                                _Stat(
                                  value: '${profile.stats.wishlist}',
                                  label: 'Wishlist',
                                ),
                                _Stat(
                                  value: '${profile.stats.unreadNotifications}',
                                  label: 'Alerts',
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        Form(
                          key: _formKey,
                          autovalidateMode:
                              AutovalidateMode.onUserInteraction,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              AppTextField(
                                controller: _firstName,
                                label: 'First name',
                                textInputAction: TextInputAction.next,
                                validator: validateFirstName,
                              ),
                              const SizedBox(height: AppSpacing.md),
                              AppTextField(
                                controller: _lastName,
                                label: 'Last name',
                                textInputAction: TextInputAction.next,
                                validator: validateLastName,
                              ),
                              const SizedBox(height: AppSpacing.md),
                              AppTextField(
                                label: 'Email',
                                initialValue: profile.user.email,
                                enabled: false,
                                hint: 'Email cannot be changed here',
                              ),
                              const SizedBox(height: AppSpacing.md),
                              AppTextField(
                                controller: _phone,
                                label: 'Phone',
                                hint: '+91 98765 43210',
                                keyboardType: TextInputType.phone,
                                validator: validatePhone,
                              ),
                              const SizedBox(height: AppSpacing.lg),
                              AppButton(
                                label: 'Save changes',
                                loading: state.saving,
                                onPressed: _save,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        Card(
                          child: Column(
                            children: [
                              ListTile(
                                leading: const Icon(Icons.verified_outlined),
                                title: const Text('Email verified'),
                                trailing: Text(
                                  profile.user.emailVerified ? 'Yes' : 'Not yet',
                                  style: const TextStyle(
                                    color: AppColors.mutedForeground,
                                  ),
                                ),
                              ),
                              ListTile(
                                leading: const Icon(Icons.shield_outlined),
                                title: const Text('Change password'),
                                trailing:
                                    const Icon(Icons.chevron_right_rounded),
                                onTap: () =>
                                    context.push(RoutePaths.profilePassword),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
    );
  }
}

class _Stat extends StatelessWidget {
  const new({required this.value, required this.label});

  final String value;
  final String label;

  @override
  Widget build(BuildContext context) => Column(
        children: [
          Text(
            value,
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
          ),
          Text(
            label,
            style: const TextStyle(color: AppColors.mutedForeground),
          ),
        ],
      );
}

class _ProfileSkeleton extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) => ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: const [
          SkeletonBox(height: 72, width: double.infinity),
          SizedBox(height: AppSpacing.md),
          SkeletonBox(height: 120, width: double.infinity),
          SizedBox(height: AppSpacing.lg),
          SkeletonBox(height: 56, width: double.infinity),
          SizedBox(height: AppSpacing.md),
          SkeletonBox(height: 56, width: double.infinity),
          SizedBox(height: AppSpacing.md),
          SkeletonBox(height: 56, width: double.infinity),
        ],
      );
}
