import 'package:cuddlehug_app/core/theme/colors.dart';
import 'package:cuddlehug_app/core/theme/spacing.dart';
import 'package:cuddlehug_app/features/catalog/data/models/product_query.dart';
import 'package:flutter/material.dart';

/// Bottom-sheet filters matching the backend `listQuerySchema`
/// (price, size, color, availability, rating). Returns the new query or
/// null when cancelled.
Future<ProductQuery?> showProductFilterSheet(
  BuildContext context,
  ProductQuery current,
) =>
    showModalBottomSheet<ProductQuery>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => _FilterSheet(current: current),
    );

const _allSizes = ['MINI', 'SMALL', 'MEDIUM', 'LARGE', 'GIANT'];
const _allColors = ['BROWN', 'PINK', 'WHITE', 'CREAM', 'RED'];

const _colorSwatches = <String, Color>{
  'BROWN': Color(0xFF8D6E63),
  'PINK': Color(0xFFF48FB1),
  'WHITE': Color(0xFFFAFAFA),
  'CREAM': Color(0xFFFFF3E0),
  'RED': Color(0xFFE57373),
};

class _FilterSheet extends StatefulWidget {
  const new({required this.current});

  final ProductQuery current;

  @override
  State<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends State<_FilterSheet> {
  late final TextEditingController _minController = TextEditingController(
    text: widget.current.minPrice?.toString() ?? '',
  );
  late final TextEditingController _maxController = TextEditingController(
    text: widget.current.maxPrice?.toString() ?? '',
  );
  late Set<String> _sizes = {...widget.current.sizes};
  late Set<String> _colors = {...widget.current.colors};
  late double? _rating = widget.current.rating;
  late String _availability = widget.current.availability;

  @override
  void dispose() {
    _minController.dispose();
    _maxController.dispose();
    super.dispose();
  }

  num? _parsePrice(TextEditingController controller) {
    final text = controller.text.trim();
    if (text.isEmpty) return null;
    final value = num.tryParse(text);
    return value != null && value >= 0 ? value : null;
  }

  int get _activeCount => ProductQuery(
        minPrice: _parsePrice(_minController),
        maxPrice: _parsePrice(_maxController),
        sizes: _sizes,
        colors: _colors,
        rating: _rating,
        availability: _availability,
      ).activeFilterCount;

  void _apply() {
    Navigator.of(context).pop(
      ProductQuery(
        search: widget.current.search,
        category: widget.current.category,
        minPrice: _parsePrice(_minController),
        maxPrice: _parsePrice(_maxController),
        sizes: _sizes,
        colors: _colors,
        rating: _rating,
        availability: _availability,
        sort: widget.current.sort,
      ),
    );
  }

  void _reset() => setState(() {
        _minController.clear();
        _maxController.clear();
        _sizes = {};
        _colors = {};
        _rating = null;
        _availability = 'all';
      });

  @override
  Widget build(BuildContext context) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.75,
        minChildSize: 0.4,
        builder: (context, scrollController) => Column(
          children: [
            Expanded(
              child: ListView(
                controller: scrollController,
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg,
                  0,
                  AppSpacing.lg,
                  AppSpacing.lg,
                ),
                children: [
                  const Text(
                    'Filters',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: AppColors.foreground,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  const _Label('Price range (₹)'),
                  const SizedBox(height: AppSpacing.sm),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _minController,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                            hintText: 'Min',
                            prefixText: '₹',
                          ),
                          onChanged: (_) => setState(() {}),
                        ),
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 8),
                        child: Text('—'),
                      ),
                      Expanded(
                        child: TextField(
                          controller: _maxController,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                            hintText: 'Max',
                            prefixText: '₹',
                          ),
                          onChanged: (_) => setState(() {}),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  const _Label('Size'),
                  const SizedBox(height: AppSpacing.sm),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final size in _allSizes)
                        ChoiceChip(
                          label: Text(_titleCase(size)),
                          selected: _sizes.contains(size),
                          onSelected: (selected) => setState(
                            () => selected
                                ? _sizes.add(size)
                                : _sizes.remove(size),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  const _Label('Color'),
                  const SizedBox(height: AppSpacing.sm),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final color in _allColors)
                        ChoiceChip(
                          avatar: CircleAvatar(
                            backgroundColor: _colorSwatches[color],
                            radius: 8,
                          ),
                          label: Text(_titleCase(color)),
                          selected: _colors.contains(color),
                          onSelected: (selected) => setState(
                            () => selected
                                ? _colors.add(color)
                                : _colors.remove(color),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  const _Label('Availability'),
                  const SizedBox(height: AppSpacing.sm),
                  Wrap(
                    spacing: 8,
                    children: [
                      for (final option in const [
                        ('all', 'All'),
                        ('in_stock', 'In stock'),
                        ('out_of_stock', 'Out of stock'),
                      ])
                        ChoiceChip(
                          label: Text(option.$2),
                          selected: _availability == option.$1,
                          onSelected: (_) =>
                              setState(() => _availability = option.$1),
                        ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  const _Label('Minimum rating'),
                  const SizedBox(height: AppSpacing.sm),
                  Wrap(
                    spacing: 8,
                    children: [
                      for (final option in const [
                        (null, 'Any'),
                        (4.0, '4★ & up'),
                        (3.0, '3★ & up'),
                        (2.0, '2★ & up'),
                      ])
                        ChoiceChip(
                          label: Text(option.$2),
                          selected: _rating == option.$1,
                          onSelected: (_) =>
                              setState(() => _rating = option.$1),
                        ),
                    ],
                  ),
                ],
              ),
            ),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg,
                  AppSpacing.sm,
                  AppSpacing.lg,
                  AppSpacing.md,
                ),
                child: Row(
                  children: [
                    OutlinedButton(onPressed: _reset, child: const Text('Reset')),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: _apply,
                        child: Text(
                          _activeCount > 0
                              ? 'Show results ($_activeCount)'
                              : 'Show results',
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      );
}

class _Label extends StatelessWidget {
  const new(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Text(
        text,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: AppColors.foreground,
        ),
      );
}

String _titleCase(String value) =>
    value.isEmpty ? value : value[0].toUpperCase() + value.substring(1).toLowerCase();
