import 'package:cuddlehug_app/app.dart';
import 'package:cuddlehug_app/core/network/dio_client.dart';
import 'package:cuddlehug_app/core/network/paged.dart';
import 'package:cuddlehug_app/core/storage/auth_session.dart';
import 'package:cuddlehug_app/core/storage/secure_store.dart';
import 'package:cuddlehug_app/features/catalog/data/catalog_repository.dart';
import 'package:cuddlehug_app/features/catalog/data/models/category.dart';
import 'package:cuddlehug_app/features/catalog/data/models/home_content.dart';
import 'package:cuddlehug_app/features/catalog/data/models/product.dart';
import 'package:cuddlehug_app/features/catalog/data/models/product_detail.dart';
import 'package:cuddlehug_app/features/catalog/data/models/product_query.dart';
import 'package:cuddlehug_app/features/catalog/data/models/review.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> _card(String id, String name) => {
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

/// Offline catalog: everything the home/shop shells render comes from
/// fixtures, so widget tests never touch the network.
class _FakeCatalogRepository extends CatalogRepository {
  new()
    : super(
        DioClient(
          authSession: AuthSession(),
          secureStore: SecureStore(),
          enableLogging: false,
        ),
      );

  @override
  Future<HomeContent> home() async => HomeContent.fromJson({
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
    ],
    'featured': [_card('p1', 'Classic Brown Teddy')],
    'bestSellers': [_card('p2', 'Pink Giant Teddy')],
    'newArrivals': [_card('p3', 'Sleepy Bunny')],
    'hero': const <Map<String, dynamic>>[],
  });

  @override
  Future<List<ShopCategory>> categories() async => [
    ShopCategory.fromJson(const {
      'id': 'c1',
      'name': 'Teddy Bears',
      'slug': 'teddy-bears',
      'description': null,
      'image': null,
      'sortOrder': 0,
      'productCount': 4,
      'childCount': 0,
    }),
  ];

  @override
  Future<Paged<ProductCard>> listProducts(ProductQuery query) async => Paged(
    items: [ProductCard.fromJson(_card('p1', 'Classic Brown Teddy'))],
    meta: PaginationMeta.fromJson(const {
      'page': 1,
      'limit': 12,
      'total': 1,
      'totalPages': 1,
    }),
  );

  @override
  Future<ProductDetail> productDetail(String slug) async =>
      ProductDetail.fromJson({
        ..._card('p1', 'Classic Brown Teddy'),
        'slug': slug,
        'description': 'A hug in bear form.',
      });

  @override
  Future<List<ProductCard>> related(String slug, {int limit = 6}) async => [];

  @override
  Future<ReviewPage> reviews(
    String productId, {
    int page = 1,
    int limit = 12,
  }) async =>
      const ReviewPage(items: [], distribution: {}, meta: PaginationMeta.first);
}

Widget _app() => ProviderScope(
  overrides: [
    catalogRepositoryProvider.overrideWithValue(_FakeCatalogRepository()),
  ],
  child: const CuddleHugApp(),
);

void main() {
  testWidgets('boots through splash into the populated home shell', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(800, 1500);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(_app());
    expect(find.text('CuddleHug'), findsWidgets);

    await tester.pumpAndSettle();
    expect(find.text('Featured for you'), findsOneWidget);
    expect(find.text('Best sellers'), findsOneWidget);
    expect(find.text('Classic Brown Teddy'), findsOneWidget);
    expect(find.text('Shop'), findsWidgets);
    expect(find.text('Cart'), findsOneWidget);
    expect(find.text('Account'), findsOneWidget);
  });

  testWidgets('bottom nav switches tabs and guards Account', (tester) async {
    tester.view.physicalSize = const Size(800, 1500);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    await tester.tap(find.text('Shop'));
    await tester.pumpAndSettle();
    expect(find.text('Filters'), findsOneWidget);
    expect(find.text('Relevance'), findsOneWidget);

    // Account is protected — a guest must be routed to sign-in.
    await tester.tap(find.text('Account'));
    await tester.pumpAndSettle();
    expect(find.text('Welcome back'), findsOneWidget);
  });
}
