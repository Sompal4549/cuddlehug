import 'package:cuddlehug_app/features/catalog/data/models/product_query.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('ProductQuery.toMap', () {
    test('always sends sort/page/limit and drops empty filters', () {
      const query = ProductQuery();
      expect(
        query.toMap(),
        {'sort': 'relevance', 'page': 1, 'limit': 12},
      );
    });

    test('serializes every backend filter with zod-expected names', () {
      const query = ProductQuery(
        search: ' teddy ',
        category: 'teddy-bears',
        minPrice: 500,
        maxPrice: 2000,
        sizes: {'MEDIUM', 'LARGE'},
        colors: {'BROWN'},
        rating: 4,
        availability: 'in_stock',
        sort: ProductSort.priceAsc,
        page: 3,
        limit: 24,
      );
      expect(query.toMap(), {
        'search': 'teddy',
        'category': 'teddy-bears',
        'minPrice': 500,
        'maxPrice': 2000,
        'size': 'MEDIUM,LARGE',
        'color': 'BROWN',
        'rating': 4,
        'availability': 'in_stock',
        'sort': 'price_asc',
        'page': 3,
        'limit': 24,
      });
    });

    test('blank search is dropped client-side', () {
      const query = ProductQuery(search: '   ');
      expect(query.toMap().containsKey('search'), isFalse);
    });

    test('atPage keeps filters and swaps only the page', () {
      const query = ProductQuery(category: 'gifts', sort: ProductSort.newest);
      final page5 = query.atPage(5);
      expect(page5.category, 'gifts');
      expect(page5.sort, ProductSort.newest);
      expect(page5.page, 5);
      expect(query.page, 1, reason: 'original stays untouched');
    });

    test('activeFilterCount counts filter groups, not values', () {
      expect(const ProductQuery().activeFilterCount, 0);
      expect(
        const ProductQuery(sizes: {'MEDIUM', 'LARGE'}).activeFilterCount,
        1,
      );
      expect(
        const ProductQuery(
          category: 'teddy-bears',
          minPrice: 100,
          rating: 4,
        ).activeFilterCount,
        3,
      );
    });

    test('equality treats size/color as sets', () {
      const a = ProductQuery(sizes: {'A', 'B'}, colors: {'X'});
      const b = ProductQuery(sizes: {'B', 'A'}, colors: {'X'});
      const c = ProductQuery(sizes: {'A'}, colors: {'X'});
      expect(a, b);
      expect(a.hashCode, b.hashCode);
      expect(a == c, isFalse);
    });
  });
}
