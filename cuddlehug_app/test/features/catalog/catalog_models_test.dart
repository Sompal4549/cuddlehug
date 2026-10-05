import 'package:cuddlehug_app/core/network/paged.dart';
import 'package:cuddlehug_app/core/utils/money.dart';
import 'package:cuddlehug_app/features/catalog/data/models/category.dart';
import 'package:cuddlehug_app/features/catalog/data/models/home_content.dart';
import 'package:cuddlehug_app/features/catalog/data/models/product.dart';
import 'package:cuddlehug_app/features/catalog/data/models/product_detail.dart';
import 'package:cuddlehug_app/features/catalog/data/models/review.dart';
import 'package:cuddlehug_app/features/catalog/data/models/wishlist_item.dart';
import 'package:flutter_test/flutter_test.dart';

/// Fixtures mirror the backend serializers exactly (research of
/// `product.service.ts`, `category.service.ts`, `review.service.ts`…).
void main() {
  Map<String, dynamic> cardJson() => {
    'id': 'p1',
    'name': 'Classic Brown Teddy',
    'slug': 'classic-brown-teddy',
    'sku': 'TED-001',
    'shortDescription': 'Soft classic teddy',
    'mrp': '1799.00',
    'price': '1499.00',
    'discountPercent': 17,
    'status': 'ACTIVE',
    'category': {'id': 'c1', 'name': 'Teddy Bears', 'slug': 'teddy-bears'},
    'images': [
      {'url': '/images/teddy.jpg', 'alt': 'Teddy', 'isPrimary': true},
    ],
    'image': '/images/teddy.jpg',
    'ratingAverage': 4.5,
    'ratingCount': 12,
    'reviewCount': 11,
    'soldCount': 40,
    'isFeatured': true,
    'isBestSeller': false,
    'isNewArrival': true,
    'inStock': true,
    'available': 7,
    'lowStock': false,
    'createdAt': '2026-09-30T08:46:22.000Z',
    'variants': [
      {
        'id': 'v1',
        'size': 'MEDIUM',
        'color': 'BROWN',
        'sku': 'TED-001-M',
        'price': '1499.00',
        'mrp': '1799.00',
        'available': 3,
      },
    ],
  };

  test('ProductCard parses card payload and money strings', () {
    final card = ProductCard.fromJson(cardJson());
    expect(card.name, 'Classic Brown Teddy');
    expect(card.priceMoney, Money.parse('1499.00'));
    expect(card.mrpMoney.minorUnits, 179900);
    expect(card.hasDiscount, isTrue);
    expect(card.category.slug, 'teddy-bears');
    expect(card.variants.single.size, 'MEDIUM');
    expect(card.createdAt.toUtc().year, 2026);
    expect(card.inStock, isTrue);
  });

  test('ProductDetail parses the slug payload superset', () {
    final detail = ProductDetail.fromJson({
      ...cardJson(),
      'description': 'A hug in bear form.',
      'material': 'Premium plush',
      'filling': 'PP cotton',
      'weightGrams': 500,
      'careInstructions': 'Hand wash cold',
      'ageRecommendation': '3+ years',
      'tags': const ['teddy', 'gift'],
      'lowStockThreshold': 5,
    });
    expect(detail.description, 'A hug in bear form.');
    expect(detail.tags, ['teddy', 'gift']);
    expect(detail.weightGrams, 500);
    expect(detail.inStock, isTrue);
    expect(detail.priceMoney, Money.parse('1499.00'));
  });

  test('ShopCategory tolerates list and detail payload shapes', () {
    final list = ShopCategory.fromJson(const {
      'id': 'c1',
      'name': 'Teddy Bears',
      'slug': 'teddy-bears',
      'description': null,
      'image': null,
      'sortOrder': 1,
      'productCount': 4,
      'childCount': 0,
    });
    expect(list.sortOrder, 1);
    expect(list.childCount, 0);

    final detail = ShopCategory.fromJson(const {
      'id': 'c1',
      'name': 'Teddy Bears',
      'slug': 'teddy-bears',
      'description': 'Cuddly friends',
      'image': null,
      'productCount': 4,
    });
    expect(detail.sortOrder, isNull);
    expect(detail.childCount, isNull);
    expect(detail.productCount, 4);
  });

  test('HomeContent parses settings + carousels', () {
    final home = HomeContent.fromJson({
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
      'featured': [cardJson()],
      'bestSellers': [cardJson()],
      'newArrivals': [cardJson()],
      'hero': const [
        {'image': '/images/hero.jpg', 'alt': 'Heroes'},
      ],
    });
    expect(home.storeName, 'CuddleHug');
    expect(home.tagline, 'More Happiness. More Hugs.');
    expect(home.categories.single.slug, 'teddy-bears');
    expect(home.featured.single.name, 'Classic Brown Teddy');
    expect(home.hero.single.alt, 'Heroes');
  });

  test('ReviewPage parses items and rating distribution', () {
    final page = ReviewPage.fromJson(const {
      'items': [
        {
          'id': 'r1',
          'rating': 5,
          'title': 'Perfect hug',
          'comment': 'So soft!',
          'imageUrl': null,
          'status': 'APPROVED',
          'createdAt': '2026-09-30T10:00:00.000Z',
          'user': {'id': 'u1', 'name': 'Asha Patel', 'avatarUrl': null},
          'product': {'id': 'p1', 'name': 'Teddy', 'slug': 'teddy'},
        },
      ],
      'distribution': {'5': 3, '4': 1, '3': 0, '2': 0, '1': 0},
    });
    expect(page.items.single.user.name, 'Asha Patel');
    expect(page.distribution['5'], 3);
    expect(page.totalReviews, 4);
    expect(page.meta.total, 0, reason: 'meta attached by the repository');
  });

  test('WishlistItem parses the wishlist summary shape', () {
    final item = WishlistItem.fromJson(const {
      'id': 'w1',
      'createdAt': '2026-09-30T10:00:00.000Z',
      'product': {
        'id': 'p1',
        'name': 'Classic Brown Teddy',
        'slug': 'classic-brown-teddy',
        'image': null,
        'price': '1499.00',
        'mrp': '1799.00',
        'discountPercent': 17,
        'ratingAverage': 4.5,
        'ratingCount': 12,
        'inStock': true,
        'variantId': 'v1',
      },
    });
    expect(item.product.priceMoney, Money.parse('1499.00'));
    expect(item.product.variantId, 'v1');
  });

  test('PaginationMeta exposes hasNext and next page', () {
    const meta = PaginationMeta(page: 2, limit: 12, total: 40, totalPages: 4);
    expect(meta.hasNext, isTrue);
    expect(meta.nextPage().page, 3);
    const last = PaginationMeta(page: 4, limit: 12, total: 40, totalPages: 4);
    expect(last.hasNext, isFalse);
    expect(PaginationMeta.fromJson(const {}).page, 1);
  });
}
