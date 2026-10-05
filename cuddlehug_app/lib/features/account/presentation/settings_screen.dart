import 'package:cuddlehug_app/core/constants/site_links.dart';
import 'package:cuddlehug_app/core/data/store_settings.dart';
import 'package:cuddlehug_app/core/theme/colors.dart';
import 'package:cuddlehug_app/core/theme/spacing.dart';
import 'package:cuddlehug_app/core/widgets/wide_body.dart';
import 'package:cuddlehug_app/features/legal/presentation/web_view_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// About / settings (`/settings`, public): store info, contact details and
/// the legal links (Privacy Policy + Terms open in an in-app WebView with
/// an "open in browser" fallback).
class SettingsScreen extends ConsumerWidget {
  const new({super.key});

  Future<void> _openDoc(BuildContext context, String title, String url) =>
      Navigator.of(context).push<void>(
        MaterialPageRoute(
          builder: (_) => WebViewScreen(title: title, url: url),
        ),
      );

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(storeSettingsProvider);
    final value = settings.value;
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: WideBody(
        child: ListView(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
          children: [
            Card(
              margin: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.lg),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      value?.storeName ?? 'CuddleHug',
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      value?.storeTagline ?? 'More Happiness. More Hugs.',
                      style: const TextStyle(color: AppColors.mutedForeground),
                    ),
                    if (settings.isLoading) ...[
                      const SizedBox(height: AppSpacing.sm),
                      const LinearProgressIndicator(),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            const _SectionHeader('Contact us'),
            if (value != null) ...[
              ListTile(
                leading: const Icon(Icons.mail_outline_rounded),
                title: Text(value.contactEmail),
                subtitle: const Text('Email'),
              ),
              ListTile(
                leading: const Icon(Icons.phone_outlined),
                title: Text(value.contactPhone),
                subtitle: const Text('Phone'),
              ),
              if (value.contactAddress.isNotEmpty)
                ListTile(
                  leading: const Icon(Icons.location_on_outlined),
                  title: Text(value.contactAddress),
                  subtitle: const Text('Address'),
                ),
            ] else
              const ListTile(
                leading: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
                title: Text('Loading store details'),
              ),
            const _SectionHeader('Legal'),
            ListTile(
              leading: const Icon(Icons.privacy_tip_outlined),
              title: const Text('Privacy Policy'),
              subtitle: const Text('How we collect and use your data'),
              trailing: const Icon(Icons.chevron_right_rounded),
              onTap: () =>
                  _openDoc(context, 'Privacy Policy', SiteLinks.privacy),
            ),
            ListTile(
              leading: const Icon(Icons.description_outlined),
              title: const Text('Terms & Conditions'),
              subtitle: const Text('Rules for shopping with CuddleHug'),
              trailing: const Icon(Icons.chevron_right_rounded),
              onTap: () =>
                  _openDoc(context, 'Terms & Conditions', SiteLinks.terms),
            ),
            const _SectionHeader('About'),
            const ListTile(
              leading: Icon(Icons.info_outline_rounded),
              title: Text('CuddleHug mobile'),
              subtitle: Text('Version 1.0.0'),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const new(this.label);

  final String label;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(
      AppSpacing.md,
      AppSpacing.md,
      AppSpacing.md,
      AppSpacing.xs,
    ),
    child: Text(
      label.toUpperCase(),
      style: const TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.6,
        color: AppColors.mutedForeground,
      ),
    ),
  );
}
