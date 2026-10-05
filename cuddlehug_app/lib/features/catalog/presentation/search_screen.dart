import 'dart:async';

import 'package:cuddlehug_app/app_providers.dart';
import 'package:cuddlehug_app/core/theme/colors.dart';
import 'package:cuddlehug_app/core/theme/spacing.dart';
import 'package:cuddlehug_app/features/catalog/application/product_list_controller.dart';
import 'package:cuddlehug_app/features/catalog/data/models/product_query.dart';
import 'package:cuddlehug_app/features/catalog/presentation/widgets/product_list_body.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Search with 300 ms debounce, recent-search history and instant
/// results via the shared product list (plan §7).
class SearchScreen extends ConsumerStatefulWidget {
  const new({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  static const _scope = 'search';

  final TextEditingController _controller = TextEditingController();
  Timer? _debounce;
  String _submitted = '';

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    final trimmed = value.trim();
    if (trimmed.isEmpty) {
      setState(() => _submitted = '');
      return;
    }
    _debounce = Timer(
      const Duration(milliseconds: 300),
      () => unawaited(_search(trimmed)),
    );
  }

  Future<void> _search(String term) async {
    _debounce?.cancel();
    setState(() => _submitted = term);
    await ref
        .read(productListProvider(_scope).notifier)
        .applyQuery(ProductQuery(search: term), force: true);
    if (term.isNotEmpty) {
      await ref.read(prefsStoreProvider).addRecentSearch(term);
    }
  }

  void _runRecent(String term) {
    _controller.text = term;
    _onChanged(term);
    unawaited(_search(term));
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(productListProvider(_scope));
    final recents = ref.read(prefsStoreProvider).readRecentSearches();
    final resultsActive = _submitted.isNotEmpty;

    return Scaffold(
      appBar: AppBar(
        title: TextField(
          controller: _controller,
          autofocus: true,
          textInputAction: TextInputAction.search,
          decoration: const InputDecoration(
            hintText: 'Search teddy bears, gifts…',
            border: InputBorder.none,
            enabledBorder: InputBorder.none,
            focusedBorder: InputBorder.none,
            filled: false,
            contentPadding: EdgeInsets.symmetric(vertical: 12),
          ),
          onChanged: _onChanged,
          onSubmitted: (value) {
            final term = value.trim();
            if (term.isNotEmpty) unawaited(_search(term));
          },
        ),
        actions: [
          if (_controller.text.isNotEmpty)
            IconButton(
              tooltip: 'Clear',
              onPressed: () {
                _controller.clear();
                _onChanged('');
              },
              icon: const Icon(Icons.close_rounded),
            ),
        ],
      ),
      body: resultsActive
          ? const ProductListBody(scope: _scope)
          : ListView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              children: [
                Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Recent searches',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppColors.foreground,
                        ),
                      ),
                    ),
                    if (recents.isNotEmpty)
                      TextButton(
                        onPressed: () async {
                          await ref
                              .read(prefsStoreProvider)
                              .clearRecentSearches();
                          setState(() {});
                        },
                        child: const Text('Clear'),
                      ),
                  ],
                ),
                for (final term in recents)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(
                      Icons.history_rounded,
                      color: AppColors.mutedForeground,
                    ),
                    title: Text(term),
                    onTap: () => _runRecent(term),
                    trailing: IconButton(
                      icon: const Icon(Icons.arrow_forward_rounded, size: 18),
                      onPressed: () => _runRecent(term),
                    ),
                  ),
                if (recents.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(top: AppSpacing.lg),
                    child: Text(
                      'Try "teddy", "gift" or a category name.',
                      style: TextStyle(
                        fontSize: 13,
                        color: AppColors.mutedForeground,
                      ),
                    ),
                  ),
                if (state.error != null && state.items.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(top: AppSpacing.lg),
                    child: Text(
                      'No matches yet — keep typing.',
                      style: TextStyle(
                        fontSize: 13,
                        color: AppColors.mutedForeground,
                      ),
                    ),
                  ),
              ],
            ),
    );
  }
}
