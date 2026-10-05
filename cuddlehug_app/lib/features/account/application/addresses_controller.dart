import 'dart:async';

import 'package:cuddlehug_app/features/account/data/address_repository.dart';
import 'package:cuddlehug_app/features/account/data/models/address.dart';
import 'package:cuddlehug_app/features/auth/application/auth_controller.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Saved-address list state. Loads on sign-in, clears on sign-out.
@immutable
class AddressesState {
  const new({
    this.items = const [],
    this.loading = false,
    this.error,
    this.busyId,
  });

  final List<Address> items;
  final bool loading;
  final Object? error;
  final String? busyId;

  bool get isEmpty => !loading && error == null && items.isEmpty;
  Address? get defaultAddress {
    for (final address in items) {
      if (address.isDefault) return address;
    }
    return items.isEmpty ? null : items.first;
  }

  AddressesState copyWith({
    List<Address>? items,
    bool? loading,
    Object? error,
    String? busyId,
    bool clearError = false,
    bool clearBusy = false,
  }) => AddressesState(
    items: items ?? this.items,
    loading: loading ?? this.loading,
    error: clearError ? null : error ?? this.error,
    busyId: clearBusy ? null : busyId ?? this.busyId,
  );
}

class AddressesController extends Notifier<AddressesState> {
  @override
  AddressesState build() {
    final authenticated = ref.watch(
      authControllerProvider.select((auth) => auth.isAuthenticated),
    );
    if (authenticated) {
      scheduleMicrotask(load);
      return const AddressesState(loading: true);
    }
    return const AddressesState();
  }

  Future<void> load() async {
    state = state.copyWith(loading: true, clearError: true);
    try {
      final items = await _repo.list();
      state = AddressesState(items: items);
    } on Object catch (error) {
      state = state.copyWith(loading: false, error: error);
    }
  }

  /// Creates the address and inserts it locally (server returns the row,
  /// already default-promoted when applicable — reload to settle ordering).
  Future<Address> create(AddressInput input) async {
    final address = await _repo.create(input);
    unawaited(load());
    return address;
  }

  Future<Address> update(String id, AddressInput input) async {
    final address = await _repo.update(id, input);
    unawaited(load());
    return address;
  }

  Future<void> remove(String id) async {
    state = state.copyWith(busyId: id, clearError: true);
    try {
      await _repo.remove(id);
      state = state.copyWith(
        items: [
          for (final address in state.items)
            if (address.id != id) address,
        ],
        clearBusy: true,
      );
    } on Object catch (error) {
      state = state.copyWith(clearBusy: true, error: error);
      rethrow;
    }
  }

  Future<void> setDefault(String id) async {
    state = state.copyWith(busyId: id, clearError: true);
    try {
      await _repo.setDefault(id);
      state = state.copyWith(
        items: [
          for (final address in state.items)
            if (address.id == id)
              Address(
                id: address.id,
                userId: address.userId,
                label: address.label,
                fullName: address.fullName,
                phone: address.phone,
                line1: address.line1,
                line2: address.line2,
                city: address.city,
                state: address.state,
                pincode: address.pincode,
                country: address.country,
                isDefault: true,
                createdAt: address.createdAt,
                updatedAt: address.updatedAt,
              )
            else
              Address(
                id: address.id,
                userId: address.userId,
                label: address.label,
                fullName: address.fullName,
                phone: address.phone,
                line1: address.line1,
                line2: address.line2,
                city: address.city,
                state: address.state,
                pincode: address.pincode,
                country: address.country,
                createdAt: address.createdAt,
                updatedAt: address.updatedAt,
              ),
        ],
        clearBusy: true,
      );
    } on Object catch (error) {
      state = state.copyWith(clearBusy: true, error: error);
      rethrow;
    }
  }

  AddressRepository get _repo => ref.read(addressRepositoryProvider);
}

final addressesProvider = NotifierProvider<AddressesController, AddressesState>(
  AddressesController.new,
);
