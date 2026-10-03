import 'package:json_annotation/json_annotation.dart';

part 'user.g.dart';

/// Safe user projection returned by the backend (`toSafeUser`).
@JsonSerializable()
class User {
  const new({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.role,
    this.phone,
    this.avatarUrl,
    this.emailVerified = false,
    this.status = 'ACTIVE',
    this.createdAt,
  });

  factory fromJson(Map<String, dynamic> json) => _$UserFromJson(json);

  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final String? phone;
  final String role;
  final String? avatarUrl;

  @JsonKey(defaultValue: false)
  final bool emailVerified;

  @JsonKey(defaultValue: 'ACTIVE')
  final String status;

  final DateTime? createdAt;

  Map<String, dynamic> toJson() => _$UserToJson(this);

  String get fullName => '$firstName $lastName'.trim();
  bool get isAdmin => role == 'ADMIN';
}
