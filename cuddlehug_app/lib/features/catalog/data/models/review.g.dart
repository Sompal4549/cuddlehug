// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'review.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ReviewUser _$ReviewUserFromJson(Map<String, dynamic> json) => ReviewUser(
  id: json['id'] as String,
  name: json['name'] as String,
  avatarUrl: json['avatarUrl'] as String?,
);

Map<String, dynamic> _$ReviewUserToJson(ReviewUser instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'avatarUrl': instance.avatarUrl,
    };

Review _$ReviewFromJson(Map<String, dynamic> json) => Review(
  id: json['id'] as String,
  rating: (json['rating'] as num).toInt(),
  comment: json['comment'] as String,
  status: json['status'] as String,
  createdAt: DateTime.parse(json['createdAt'] as String),
  user: ReviewUser.fromJson(json['user'] as Map<String, dynamic>),
  title: json['title'] as String?,
  imageUrl: json['imageUrl'] as String?,
);

Map<String, dynamic> _$ReviewToJson(Review instance) => <String, dynamic>{
  'id': instance.id,
  'rating': instance.rating,
  'title': instance.title,
  'comment': instance.comment,
  'imageUrl': instance.imageUrl,
  'status': instance.status,
  'createdAt': instance.createdAt.toIso8601String(),
  'user': instance.user,
};
