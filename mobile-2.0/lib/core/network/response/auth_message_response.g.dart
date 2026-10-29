// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_message_response.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AuthMessageResponse _$AuthMessageResponseFromJson(Map<String, dynamic> json) =>
    AuthMessageResponse(
      ok: json['ok'] as bool?,
      message: json['message'] as String?,
    );

Map<String, dynamic> _$AuthMessageResponseToJson(
  AuthMessageResponse instance,
) => <String, dynamic>{'ok': instance.ok, 'message': instance.message};
