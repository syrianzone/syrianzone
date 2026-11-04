import 'package:json_annotation/json_annotation.dart';

part 'user_response.g.dart';

@JsonSerializable()
class UserResponse {
  final int id;
  final String? name;
  final String email;
  @JsonKey(name: 'avatar_url')
  final String? avatarUrl;
  final String? role;
  @JsonKey(name: 'effective_permissions')
  final List<String>? effectivePermissions;
  @JsonKey(name: 'transit_governorates')
  final List<String>? transitGovernorates;
  @JsonKey(name: 'radio_bytes_total')
  final int? radioBytesTotal;
  @JsonKey(name: 'radio_seconds_total')
  final int? radioSecondsTotal;

  const UserResponse({
    required this.id,
    this.name,
    required this.email,
    this.avatarUrl,
    this.role,
    this.effectivePermissions,
    this.transitGovernorates,
    this.radioBytesTotal,
    this.radioSecondsTotal,
  });

  factory UserResponse.fromJson(Map<String, dynamic> json) =>
      _$UserResponseFromJson(json);

  Map<String, dynamic> toJson() => _$UserResponseToJson(this);

  bool hasPermission(String permission) {
    if (role == 'superadmin') return true;
    return effectivePermissions?.contains(permission) ?? false;
  }
}
