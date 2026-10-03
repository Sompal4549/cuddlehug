import 'package:cuddlehug_app/core/network/api_exception.dart';
import 'package:cuddlehug_app/core/network/dio_client.dart';
import 'package:cuddlehug_app/core/network/paged.dart';
import 'package:cuddlehug_app/core/storage/auth_session.dart';
import 'package:cuddlehug_app/core/storage/secure_store.dart';
import 'package:cuddlehug_app/features/catalog/application/wishlist_controller.dart';
import 'package:cuddlehug_app/features/catalog/data/models/wishlist_item.dart';
import 'package:cuddlehug_app/features/catalog/data/wishlist_repository.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeWishlistRepository extends WishlistRepository {
  new()
      : super(
          DioClient(
            authSession: AuthSession(),
            secureStore: SecureStore(),
            enableLogging: false,
          ),
        );

  bool failAdd = false;
  bool failRemove = false;
  final List<String> added = [];
  final List<String> removed = [];

  @override
  Future<bool> add(String productId) async {
    if (failAdd) {
      throw const ApiException(message: 'nope', code: 'FORBIDDEN', status: 403);
    }
    added.add(productId);
    return true;
  }

  @override
  Future<bool> remove(String productId) async {
    if (failRemove) {
      throw const ApiException(message: 'nope', code: 'FORBIDDEN', status: 403);
    }
    removed.add(productId);
    return true;
  }

  @override
  Future<Paged<WishlistItem>> list({int page = 1, int limit = 12}) async =>
      const Paged(items: [], meta: PaginationMeta.first);
}

void main() {
  late _FakeWishlistRepository repo;
  late ProviderContainer container;

  setUp(() {
    repo = _FakeWishlistRepository();
    container = ProviderContainer(
      overrides: [wishlistRepositoryProvider.overrideWithValue(repo)],
    );
    addTearDown(container.dispose);
  });

  WishlistController controller() =>
      container.read(wishlistProvider.notifier);

  test('toggle adds a product to the id set optimistically', () async {
    final added = await controller().toggle('p1');
    expect(added, isTrue);
    expect(container.read(wishlistProvider).contains('p1'), isTrue);
    expect(repo.added, ['p1']);
  });

  test('toggle removes a product and reports false', () async {
    await controller().toggle('p1');
    final added = await controller().toggle('p1');
    expect(added, isFalse);
    expect(container.read(wishlistProvider).contains('p1'), isFalse);
    expect(repo.removed, ['p1']);
  });

  test('failed toggle reverts the optimistic id set and rethrows', () async {
    repo.failAdd = true;
    await expectLater(controller().toggle('p1'), throwsA(isA<ApiException>()));
    expect(container.read(wishlistProvider).contains('p1'), isFalse);
    expect(
      container.read(wishlistProvider).busyIds,
      isEmpty,
      reason: 'busy flag must clear after failure',
    );
  });
}
