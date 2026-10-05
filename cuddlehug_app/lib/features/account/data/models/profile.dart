import 'package:cuddlehug_app/features/auth/data/models/user.dart';
import 'package:flutter/foundation.dart';
import 'package:json_annotation/json_annotation.dart';

part 'profile.g.dart';

/// Counters returned alongside the profile (`stats`).
@immutable
@JsonSerializable()
class ProfileStats {
  const new({this.orders = 0, this.wishlist = 0, this.unreadNotifications = 0});

  factory fromJson(Map<String, dynamic> json) => _$ProfileStatsFromJson(json);

  @JsonKey(defaultValue: 0)
  final int orders;

  @JsonKey(defaultValue: 0)
  final int wishlist;

  @JsonKey(defaultValue: 0)
  final int unreadNotifications;
}

/// `GET /api/profile` payload (same shape as `GET /api/auth/me`).
@immutable
@JsonSerializable()
class ProfileResponse {
  const new({required this.user, required this.stats});

  factory fromJson(Map<String, dynamic> json) =>
      _$ProfileResponseFromJson(json);

  final User user;
  final ProfileStats stats;
}
