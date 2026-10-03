// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'address.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Address _$AddressFromJson(Map<String, dynamic> json) => Address(
  id: json['id'] as String?,
  fullName: json['fullName'] as String,
  phone: json['phone'] as String,
  line1: json['line1'] as String,
  city: json['city'] as String,
  state: json['state'] as String,
  pincode: json['pincode'] as String,
  userId: json['userId'] as String?,
  label: json['label'] as String? ?? 'Home',
  line2: json['line2'] as String?,
  country: json['country'] as String? ?? 'India',
  isDefault: json['isDefault'] as bool? ?? false,
  createdAt: json['createdAt'] == null
      ? null
      : DateTime.parse(json['createdAt'] as String),
  updatedAt: json['updatedAt'] == null
      ? null
      : DateTime.parse(json['updatedAt'] as String),
);

Map<String, dynamic> _$AddressToJson(Address instance) => <String, dynamic>{
  'id': instance.id,
  'userId': instance.userId,
  'label': instance.label,
  'fullName': instance.fullName,
  'phone': instance.phone,
  'line1': instance.line1,
  'line2': instance.line2,
  'city': instance.city,
  'state': instance.state,
  'pincode': instance.pincode,
  'country': instance.country,
  'isDefault': instance.isDefault,
  'createdAt': instance.createdAt?.toIso8601String(),
  'updatedAt': instance.updatedAt?.toIso8601String(),
};
