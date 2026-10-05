import 'package:cuddlehug_app/features/catalog/application/catalog_providers.dart';
import 'package:cuddlehug_app/features/catalog/data/models/home_content.dart';
import 'package:cuddlehug_app/features/home/home_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// Fixture uses empty image lists so widget tests never hit the network.
HomeContent _content() => HomeContent.fromJson({
  'settings': const {
    'store.name': 'CuddleHug',
    'store.tagline': 'More Happiness. More Hugs.',
    'shipping.freeThreshold': 999,
  },
  'categories': const [
    {
      'id': 'c1',
      'name': 'Teddy Bears',
      'slug': 'teddy-bears',
      'description': null,
      'image': null,
      'sortOrder': 0,
      'productCount': 4,
      'childCount': 0,
    },
    {
      'id': 'c2',
      'name': 'Gift Sets',
      'slug': 'gift-sets',
      'description': null,
      'image': null,
      'sortOrder': 1,
      'productCount': 2,
      'childCount': 0,
    },
  ],
  'featured': [_product('p1', 'Classic Brown Teddy')],
  'bestSellers': [_product('p2', 'Pink Giant Teddy')],
  'newArrivals': [_product('p3', 'Sleepy Bunny')],
  'hero': const <Map<String, dynamic>>[],
});

Map<String, dynamic> _product(String id, String name) => {
  'id': id,
  'name': name,
  'slug': 'product-$id',
  'sku': 'SKU-$id',
  'shortDescription': null,
  'mrp': '1799.00',
  'price': '1499.00',
  'discountPercent': 17,
  'status': 'ACTIVE',
  'category': {'id': 'c1', 'name': 'Teddy Bears', 'slug': 'teddy-bears'},
  'images': <Map<String, dynamic>>[],
  'image': null,
  'ratingAverage': 4.5,
  'ratingCount': 12,
  'reviewCount': 11,
  'soldCount': 40,
  'isFeatured': true,
  'isBestSeller': false,
  'isNewArrival': false,
  'inStock': true,
  'available': 7,
  'lowStock': false,
  'createdAt': '2026-09-30T08:46:22.000Z',
  'variants': <Map<String, dynamic>>[],
};

Widget _app() => ProviderScope(
  overrides: [homeContentProvider.overrideWith((ref) async => _content())],
  child: const MaterialApp(home: HomeScreen()),
);

void main() {
  testWidgets('home renders store name, sections and product rows', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(800, 1500);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    expect(find.text('CuddleHug'), findsOneWidget);
    expect(
      find.textContaining('Free shipping on orders above'),
      findsOneWidget,
    );
    expect(find.text('Shop by category'), findsOneWidget);
    expect(find.text('Featured for you'), findsOneWidget);
    expect(find.text('Best sellers'), findsOneWidget);
    expect(find.text('New arrivals'), findsOneWidget);
    expect(find.text('Classic Brown Teddy'), findsOneWidget);
    expect(find.text('Pink Giant Teddy'), findsOneWidget);
    expect(find.text('Sleepy Bunny'), findsOneWidget);
    expect(find.text('Teddy Bears'), findsOneWidget);
    expect(find.text('₹1,499.00'), findsWidgets);
    expect(find.text('17% off'), findsWidgets);
  });

  testWidgets('home shows an error view with retry when the load fails', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          homeContentProvider.overrideWith(
            (ref) async => throw Exception('boom'),
          ),
        ],
        child: const MaterialApp(home: HomeScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Something went wrong'), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);
  });
}
