import 'package:flutter/foundation.dart';
import 'package:json_annotation/json_annotation.dart';

part 'address.g.dart';

/// Saved delivery address (`/api/addresses`). The list payload omits
/// `createdAt`; create/update responses include it — both nullable here.
@immutable
@JsonSerializable()
class Address {
  const new({
    required this.id,
    required this.fullName, required this.phone, required this.line1, required this.city, required this.state, required this.pincode, this.userId,
    this.label = 'Home',
    this.line2,
    this.country = 'India',
    this.isDefault = false,
    this.createdAt,
    this.updatedAt,
  });

  factory fromJson(Map<String, dynamic> json) =>
      _$AddressFromJson(json);

  final String? id;
  final String? userId;
  final String label;
  final String fullName;
  final String phone;
  final String line1;
  final String? line2;
  final String city;
  final String state;
  final String pincode;
  final String country;
  final bool isDefault;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  /// Single-line rendering for order summaries and pickers.
  String get singleLine {
    final parts = [line1, if (line2 != null && line2!.isNotEmpty) line2!, city];
    return parts.join(', ');
  }

  String get fullLabel => '$city, $state $pincode';
}

/// Create/update payload matching the backend `createAddressSchema`.
@immutable
class AddressInput {
  const new({
    required this.fullName, required this.phone, required this.line1, required this.city, required this.state, required this.pincode, this.label = 'Home',
    this.line2,
    this.country = 'India',
    this.isDefault = false,
  });

  final String label;
  final String fullName;
  final String phone;
  final String line1;
  final String? line2;
  final String city;
  final String state;
  final String pincode;
  final String country;
  final bool isDefault;

  Map<String, Object?> toJson() => {
        'label': label,
        'fullName': fullName,
        'phone': phone,
        'line1': line1,
        'line2': line2,
        'city': city,
        'state': state,
        'pincode': pincode,
        'country': country,
        'isDefault': isDefault,
      };
}
