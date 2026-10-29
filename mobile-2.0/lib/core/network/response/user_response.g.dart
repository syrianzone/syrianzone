// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'user_response.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UserResponse _$UserResponseFromJson(Map<String, dynamic> json) => UserResponse(
  id: (json['id'] as num).toInt(),
  name: json['name'] as String?,
  email: json['email'] as String,
  avatarUrl: json['avatar_url'] as String?,
  role: json['role'] as String?,
  effectivePermissions: (json['effective_permissions'] as List<dynamic>?)
      ?.map((e) => e as String)
      .toList(),
  transitGovernorates: (json['transit_governorates'] as List<dynamic>?)
      ?.map((e) => e as String)
      .toList(),
  radioBytesTotal: (json['radio_bytes_total'] as num?)?.toInt(),
  radioSecondsTotal: (json['radio_seconds_total'] as num?)?.toInt(),
);

Map<String, dynamic> _$UserResponseToJson(UserResponse instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'email': instance.email,
      'avatar_url': instance.avatarUrl,
      'role': instance.role,
      'effective_permissions': instance.effectivePermissions,
      'transit_governorates': instance.transitGovernorates,
      'radio_bytes_total': instance.radioBytesTotal,
      'radio_seconds_total': instance.radioSecondsTotal,
    };
