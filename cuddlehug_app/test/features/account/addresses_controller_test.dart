import 'package:cuddlehug_app/core/network/api_exception.dart';
import 'package:cuddlehug_app/core/network/dio_client.dart';
import 'package:cuddlehug_app/core/storage/auth_session.dart';
import 'package:cuddlehug_app/core/storage/secure_store.dart';
import 'package:cuddlehug_app/features/account/application/addresses_controller.dart';
import 'package:cuddlehug_app/features/account/data/address_repository.dart';
import 'package:cuddlehug_app/features/account/data/models/address.dart';
import 'package:cuddlehug_app/features/auth/application/auth_controller.dart';
import 'package:cuddlehug_app/features/auth/data/models/user.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> _addressJson({
  String id = 'a1',
  String label = 'Home',
  bool isDefault = false,
  String line1 = '12 Cuddle Lane',
}) =>
    <String, dynamic>{
      'id': id,
      'userId': 'u1',
      'label': label,
      'fullName': 'Asha Patel',
      'phone': '9876543210',
      'line1': line1,
      'line2': null,
      'city': 'Pune',
      'state': 'Maharashtra',
      'pincode': '411001',
      'country': 'India',
      'isDefault': isDefault,
      'updatedAt': '2026-01-01T10:00:00.000Z',
    };

class _FakeAddressRepository extends AddressRepository {
  new()
      : super(
          DioClient(
            authSession: AuthSession(),
            secureStore: SecureStore(),
            enableLogging: false,
          ),
        );

  bool failDelete = false;
  final List<Map<String, dynamic>> rows = [
    _addressJson(isDefault: true),
    _addressJson(id: 'a2', label: 'Work', line1: '9 Soft Street'),
  ];
  final List<String> calls = [];

  @override
  Future<List<Address>> list() async =>
      rows.map(Address.fromJson).toList(growable: false);

  @override
  Future<Address> create(AddressInput input) async {
    calls.add('create:${input.label}');
    final created = _addressJson(id: 'a3', label: input.label);
    return Address.fromJson(created);
  }

  @override
  Future<Address> update(String id, AddressInput input) async {
    calls.add('update:$id');
    return Address.fromJson(_addressJson(id: id, label: input.label));
  }

  @override
  Future<void> remove(String id) async {
    if (failDelete) {
      throw const ApiException(
        message: 'Address not found',
        code: 'NOT_FOUND',
        status: 404,
      );
    }
    calls.add('remove:$id');
    rows.removeWhere((row) => row['id'] == id);
  }

  @override
  Future<void> setDefault(String id) async {
    calls.add('default:$id');
    for (final row in rows) {
      row['isDefault'] = row['id'] == id;
    }
  }
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
  late _FakeAddressRepository repo;
  late ProviderContainer container;

  setUp(() {
    repo = _FakeAddressRepository();
    container = ProviderContainer(
      overrides: [
        authControllerProvider.overrideWith(_AuthedAuth.new),addressRepositoryProvider.overrideWithValue(repo)],
    );
    addTearDown(container.dispose);
  });

  AddressesController controller() =>
      container.read(addressesProvider.notifier);
  AddressesState state() => container.read(addressesProvider);

  test('loads saved addresses on first read', () async {
    container.read(addressesProvider);
    await Future<void>.delayed(Duration.zero);
    expect(state().items, hasLength(2));
    expect(state().loading, isFalse);
    expect(state().defaultAddress!.id, 'a1');
  });

  test('create calls the repository with the input', () async {
    container.read(addressesProvider);
    await Future<void>.delayed(Duration.zero);
    await controller().create(
      const AddressInput(
        fullName: 'Asha Patel',
        phone: '9876543210',
        line1: '12 Cuddle Lane',
        city: 'Pune',
        state: 'Maharashtra',
        pincode: '411001',
      ),
    );
    expect(repo.calls, ['create:Home']);
  });

  test('remove drops the address locally', () async {
    container.read(addressesProvider);
    await Future<void>.delayed(Duration.zero);
    await controller().remove('a2');
    expect(state().items.map((a) => a.id), ['a1']);
    expect(state().busyId, isNull);
  });

  test('failed remove rethrows and keeps the list intact', () async {
    container.read(addressesProvider);
    await Future<void>.delayed(Duration.zero);
    repo.failDelete = true;
    await expectLater(controller().remove('a2'), throwsA(isA<ApiException>()));
    expect(state().items, hasLength(2));
    expect(state().busyId, isNull);
    expect(state().error, isA<ApiException>());
  });

  test('setDefault moves the default flag', () async {
    container.read(addressesProvider);
    await Future<void>.delayed(Duration.zero);
    await controller().setDefault('a2');
    final defaults =
        state().items.where((address) => address.isDefault).toList();
    expect(defaults, hasLength(1));
    expect(defaults.single.id, 'a2');
  });
}
