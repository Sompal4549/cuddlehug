// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'profile.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ProfileStats _$ProfileStatsFromJson(Map<String, dynamic> json) => ProfileStats(
  orders: (json['orders'] as num?)?.toInt() ?? 0,
  wishlist: (json['wishlist'] as num?)?.toInt() ?? 0,
  unreadNotifications: (json['unreadNotifications'] as num?)?.toInt() ?? 0,
);

Map<String, dynamic> _$ProfileStatsToJson(ProfileStats instance) =>
    <String, dynamic>{
      'orders': instance.orders,
      'wishlist': instance.wishlist,
      'unreadNotifications': instance.unreadNotifications,
    };

ProfileResponse _$ProfileResponseFromJson(Map<String, dynamic> json) =>
    ProfileResponse(
      user: User.fromJson(json['user'] as Map<String, dynamic>),
      stats: ProfileStats.fromJson(json['stats'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$ProfileResponseToJson(ProfileResponse instance) =>
    <String, dynamic>{'user': instance.user, 'stats': instance.stats};
