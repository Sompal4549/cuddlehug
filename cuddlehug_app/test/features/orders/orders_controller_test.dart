import 'package:cuddlehug_app/core/network/api_exception.dart';
import 'package:cuddlehug_app/core/network/dio_client.dart';
import 'package:cuddlehug_app/core/network/paged.dart';
import 'package:cuddlehug_app/core/storage/auth_session.dart';
import 'package:cuddlehug_app/core/storage/secure_store.dart';
import 'package:cuddlehug_app/features/auth/application/auth_controller.dart';
import 'package:cuddlehug_app/features/auth/data/models/user.dart';
import 'package:cuddlehug_app/features/orders/application/orders_controller.dart';
import 'package:cuddlehug_app/features/orders/data/models/order.dart';
import 'package:cuddlehug_app/features/orders/data/order_repository.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> _orderJson({
  String id = 'o1',
  String number = 'CH-0001-000123',
  String status = 'DELIVERED',
  int page = 1,
}) => <String, dynamic>{
  'id': id,
  'orderNumber': number,
  'status': status,
  'paymentStatus': 'PAID',
  'paymentMethod': 'RAZORPAY',
  'subtotal': '600.00',
  'discountAmount': '0.00',
  'couponCode': null,
  'shippingAmount': '0.00',
  'taxAmount': '108.00',
  'totalAmount': '708.00',
  'currency': 'INR',
  'shippingAddress': null,
  'billingAddress': null,
  'trackingNumber': null,
  'courierName': null,
  'estimatedDelivery': null,
  'cancelReason': null,
  'placedAt': '2026-01-01T10:00:00.000Z',
  'paidAt': '2026-01-01T10:00:05.000Z',
  'createdAt': '2026-01-0${page > 1 ? 2 : 1}T10:00:00.000Z',
  'updatedAt': '2026-01-01T10:00:00.000Z',
  'user': <String, dynamic>{
    'id': 'u1',
    'firstName': 'Asha',
    'lastName': 'Patel',
    'email': 'asha@example.com',
    'phone': null,
  },
  'payment': null,
  'items': <Map<String, dynamic>>[
    {
      'id': 'oi1',
      'productId': 'p1',
      'variantId': 'v1',
      'productName': 'Giant Teddy Bear',
      'productSlug': 'giant-teddy-bear',
      'variantLabel': 'GIANT / BROWN',
      'sku': 'TDY-GI-BRN',
      'imageUrl': null,
      'unitPrice': '300.00',
      'mrp': '499.00',
      'quantity': 2,
      'lineTotal': '600.00',
    },
  ],
  'history': <Map<String, dynamic>>[
    {
      'id': 'h1',
      'status': 'PENDING',
      'note': 'Order placed',
      'createdAt': '2026-01-01T10:00:00.000Z',
    },
  ],
};

class _FakeOrderRepository extends OrderRepository {
  new()
    : super(
        DioClient(
          authSession: AuthSession(),
          secureStore: SecureStore(),
          enableLogging: false,
        ),
      );

  int listCalls = 0;

  @override
  Future<Paged<Order>> list({int page = 1, int limit = 12}) async {
    listCalls++;
    final items = [
      for (var i = 0; i < 2; i++)
        Order.fromJson(_orderJson(id: 'o${page}_$i', page: page)),
    ];
    return Paged(
      items: items,
      meta: PaginationMeta(page: page, limit: limit, total: 5, totalPages: 3),
    );
  }

  @override
  Future<Order> getById(String id) async => Order.fromJson(_orderJson(id: id));

  @override
  Future<OrderStats> stats() async =>
      OrderStats.fromJson(const <String, dynamic>{
        'totalOrders': 5,
        'pendingOrders': 1,
        'deliveredOrders': 3,
        'cancelledOrders': 1,
        'totalSpend': '1500.00',
      });
}

class _AuthedAuth extends AuthController {
  @override
  AuthState build() => const AuthState.authenticated(
    User(
      id: 'u1',
      email: 'asha@example.com',
      firstName: 'Asha',
      lastName: 'Patel',
      role: 'CUSTOMER',
    ),
  );
}

void main() {
  late _FakeOrderRepository repo;
  late ProviderContainer container;

  setUp(() {
    repo = _FakeOrderRepository();
    container = ProviderContainer(
      overrides: [
        authControllerProvider.overrideWith(_AuthedAuth.new),
        orderRepositoryProvider.overrideWithValue(repo),
      ],
    );
    addTearDown(container.dispose);
  });

  OrdersController controller() => container.read(ordersProvider.notifier);
  OrdersState state() => container.read(ordersProvider);

  test('loads the first page on first read', () async {
    container.read(ordersProvider);
    await Future<void>.delayed(Duration.zero);
    expect(state().items, hasLength(2));
    expect(state().meta.page, 1);
    expect(state().hasMore, isTrue);
    expect(state().loading, isFalse);
  });

  test('loadMore appends the next page', () async {
    container.read(ordersProvider);
    await Future<void>.delayed(Duration.zero);
    await controller().loadMore();
    expect(state().items, hasLength(4));
    expect(state().meta.page, 2);
    expect(state().loadingMore, isFalse);
  });

  test('loadMore stops on the last page', () async {
    container.read(ordersProvider);
    await Future<void>.delayed(Duration.zero);
    await controller().loadMore();
    await controller().loadMore();
    expect(state().meta.page, 3);
    expect(state().hasMore, isFalse);
    final calls = repo.listCalls;
    await controller().loadMore();
    expect(repo.listCalls, calls, reason: 'no request beyond last page');
  });

  test('detail provider decodes a single order', () async {
    final order = await container.read(orderDetailProvider('o9').future);
    expect(order.id, 'o9');
    expect(order.orderNumber, 'CH-0001-000123');
    expect(order.status, 'DELIVERED');
    expect(order.isDelivered, isTrue);
    expect(order.totalMoney.minorUnits, 70800);
    expect(order.items.single.productName, 'Giant Teddy Bear');
    expect(order.history.single.status, 'PENDING');
  });

  test('stats provider decodes totals', () async {
    final stats = await container.read(orderStatsProvider.future);
    expect(stats.totalOrders, 5);
    expect(stats.totalSpendMoney.minorUnits, 150000);
  });

  test('load failure surfaces the error', () async {
    final c = ProviderContainer(
      overrides: [
        authControllerProvider.overrideWith(_AuthedAuth.new),
        orderRepositoryProvider.overrideWithValue(_FailingOrders()),
      ],
    );
    addTearDown(c.dispose);
    c.read(ordersProvider);
    await Future<void>.delayed(Duration.zero);
    expect(c.read(ordersProvider).error, isA<ApiException>());
  });
}

class _FailingOrders extends OrderRepository {
  new()
    : super(
        DioClient(
          authSession: AuthSession(),
          secureStore: SecureStore(),
          enableLogging: false,
        ),
      );

  @override
  Future<Paged<Order>> list({int page = 1, int limit = 12}) async {
    throw const ApiException(
      message: 'offline',
      code: 'INTERNAL_ERROR',
      status: 500,
    );
  }

  @override
  Future<Order> getById(String id) async {
    throw const ApiException(message: 'nope', code: 'NOT_FOUND', status: 404);
  }

  @override
  Future<OrderStats> stats() async {
    throw const ApiException(message: 'nope', code: 'NOT_FOUND', status: 404);
  }
}
