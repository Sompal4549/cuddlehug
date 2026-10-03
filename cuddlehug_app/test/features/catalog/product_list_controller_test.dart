import 'package:cuddlehug_app/core/network/dio_client.dart';
import 'package:cuddlehug_app/core/network/paged.dart';
import 'package:cuddlehug_app/core/storage/auth_session.dart';
import 'package:cuddlehug_app/core/storage/secure_store.dart';
import 'package:cuddlehug_app/features/catalog/application/product_list_controller.dart';
import 'package:cuddlehug_app/features/catalog/data/catalog_repository.dart';
import 'package:cuddlehug_app/features/catalog/data/models/product.dart';
import 'package:cuddlehug_app/features/catalog/data/models/product_query.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

ProductCard _card(String id) => ProductCard(
      id: id,
      name: 'Product $id',
      slug: 'product-$id',
      sku: 'SKU-$id',
      mrp: '100.00',
      price: '80.00',
      discountPercent: 20,
      status: 'ACTIVE',
      category: const CategoryRef(id: 'c1', name: 'Cat', slug: 'cat'),
      images: const [],
      createdAt: DateTime.utc(2026),
    );

class _FakeCatalogRepository extends CatalogRepository {
  new(this._pages)
      : super(
          DioClient(
            authSession: AuthSession(),
            secureStore: SecureStore(),
            enableLogging: false,
          ),
        );

  /// page number → response.
  final Map<int, Paged<ProductCard>> _pages;
  final List<ProductQuery> queries = [];
  Exception? thrown;

  @override
  Future<Paged<ProductCard>> listProducts(ProductQuery query) async {
    queries.add(query);
    final error = thrown;
    if (error != null) throw error;
    return _pages[query.page] ??
        Paged(
          items: const [],
          meta: PaginationMeta.fromJson({
            'page': query.page,
            'limit': query.limit,
            'total': 0,
            'totalPages': 1,
          }),
        );
  }
}

void main() {
  late _FakeCatalogRepository repo;
  late ProviderContainer container;

  ProductListState stateOf(String scope) => container.read(productListProvider(scope));

  setUp(() {
    repo = _FakeCatalogRepository({
      1: Paged(
        items: [_card('a'), _card('b')],
        meta: PaginationMeta.fromJson(const {
          'page': 1,
          'limit': 2,
          'total': 3,
          'totalPages': 2,
        }),
      ),
      2: Paged(
        items: [_card('c')],
        meta: PaginationMeta.fromJson(const {
          'page': 2,
          'limit': 2,
          'total': 3,
          'totalPages': 2,
        }),
      ),
    });
    container = ProviderContainer(
      overrides: [catalogRepositoryProvider.overrideWithValue(repo)],
    );
    addTearDown(container.dispose);
  });

  ProductListController controllerOf(String scope) =>
      container.read(productListProvider(scope).notifier);

  test('applyQuery loads page 1 with the exact query passed to the API',
      () async {
    final controller = controllerOf('shop');
    await controller.applyQuery(
      const ProductQuery(category: 'gifts', sort: ProductSort.newest),
    );
    final state = stateOf('shop');
    expect(state.items.map((item) => item.id), ['a', 'b']);
    expect(state.meta.total, 3);
    expect(state.hasMore, isTrue);
    expect(state.loading, isFalse);
    expect(repo.queries.single.category, 'gifts');
    expect(repo.queries.single.page, 1);
  });

  test('identical query is not refetched unless forced', () async {
    final controller = controllerOf('shop');
    await controller.applyQuery(const ProductQuery());
    await controller.applyQuery(const ProductQuery());
    expect(repo.queries, hasLength(1));
    await controller.applyQuery(const ProductQuery(), force: true);
    expect(repo.queries, hasLength(2));
  });

  test('loadMore appends the next page and stops at the last one', () async {
    final controller = controllerOf('shop');
    await controller.applyQuery(const ProductQuery());
    await controller.loadMore();
    var state = stateOf('shop');
    expect(state.items.map((item) => item.id), ['a', 'b', 'c']);
    expect(state.hasMore, isFalse);
    await controller.loadMore();
    state = stateOf('shop');
    expect(state.items, hasLength(3), reason: 'no extra fetch past the end');
    expect(repo.queries, hasLength(2));
  });

  test('errors surface as state and recover on the next forced load',
      () async {
    final controller = controllerOf('shop');
    repo.thrown = Exception('offline');
    await controller.applyQuery(const ProductQuery());
    var state = stateOf('shop');
    expect(state.error, isNotNull);
    expect(state.items, isEmpty);

    repo.thrown = null;
    await controller.applyQuery(const ProductQuery(), force: true);
    state = stateOf('shop');
    expect(state.error, isNull);
    expect(state.items, hasLength(2));
  });

  test('scopes stay independent (shop vs category)', () async {
    await controllerOf('shop').applyQuery(const ProductQuery());
    await controllerOf('category:gifts')
        .applyQuery(const ProductQuery(category: 'gifts'));
    expect(stateOf('shop').items, hasLength(2));
    expect(stateOf('category:gifts').items, hasLength(2));
    expect(stateOf('shop').query.category, isNull);
    expect(stateOf('category:gifts').query.category, 'gifts');
  });
}
