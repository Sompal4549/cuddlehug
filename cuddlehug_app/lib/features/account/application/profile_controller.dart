import 'dart:async';

import 'package:cuddlehug_app/features/account/data/models/profile.dart';
import 'package:cuddlehug_app/features/account/data/profile_repository.dart';
import 'package:cuddlehug_app/features/auth/application/auth_controller.dart';
import 'package:cuddlehug_app/features/auth/data/models/user.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

@immutable
class ProfileState {
  const new({
    this.profile,
    this.loading = false,
    this.saving = false,
    this.error,
  });

  final ProfileResponse? profile;
  final bool loading;
  final bool saving;
  final Object? error;

  User? get user => profile?.user;

  bool get isAuthed => user != null;
}

class ProfileController extends Notifier<ProfileState> {
  ProfileRepository get _repository => ref.read(profileRepositoryProvider);

  @override
  ProfileState build() {
    final isAuthenticated = ref.watch(
      authControllerProvider.select((s) => s.isAuthenticated),
    );
    if (!isAuthenticated) return const ProfileState();
    // Loading must not start synchronously — Notifier.build cannot touch
    // `state` yet (Bad state), so defer the first fetch like the other
    // auth-gated controllers.
    scheduleMicrotask(load);
    return const ProfileState(loading: true);
  }

  Future<void> load() async {
    state = const ProfileState(loading: true);
    try {
      final profile = await _repository.getProfile();
      state = ProfileState(profile: profile);
    } on Exception catch (e) {
      state = ProfileState(error: e);
    }
  }

  Future<User> update({
    String? firstName,
    String? lastName,
    String? phone,
    String? avatarUrl,
  }) async {
    state = ProfileState(profile: state.profile, saving: true);
    try {
      final user = await _repository.updateProfile(
        firstName: firstName,
        lastName: lastName,
        phone: phone,
        avatarUrl: avatarUrl,
      );
      final profile = state.profile;
      state = profile == null
          ? const ProfileState()
          : ProfileState(
              profile: ProfileResponse(user: user, stats: profile.stats),
            );
      return user;
    } on Object {
      // Keep the old profile and clear the busy flag, then rethrow so the
      // screen can show the backend message.
      state = ProfileState(profile: state.profile);
      rethrow;
    }
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) => _repository.changePassword(
    currentPassword: currentPassword,
    newPassword: newPassword,
  );
}

/// Auth-gated profile with counters; empty for guests.
final profileProvider = NotifierProvider<ProfileController, ProfileState>(
  ProfileController.new,
);
