// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'google_token_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

GoogleTokenRequest _$GoogleTokenRequestFromJson(Map<String, dynamic> json) =>
    GoogleTokenRequest(
      idToken: json['id_token'] as String?,
      accessToken: json['access_token'] as String?,
      deviceName: json['device_name'] as String?,
    );

Map<String, dynamic> _$GoogleTokenRequestToJson(GoogleTokenRequest instance) =>
    <String, dynamic>{
      'id_token': instance.idToken,
      'access_token': instance.accessToken,
      'device_name': instance.deviceName,
    };
