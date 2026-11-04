// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'submit_place_response.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SubmitPlaceResponse _$SubmitPlaceResponseFromJson(Map<String, dynamic> json) =>
    SubmitPlaceResponse(
      id: (json['id'] as num).toInt(),
      status: json['status'] as String,
    );

Map<String, dynamic> _$SubmitPlaceResponseToJson(
  SubmitPlaceResponse instance,
) => <String, dynamic>{'id': instance.id, 'status': instance.status};
