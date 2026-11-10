// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'save_place_response.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SavePlaceResponse _$SavePlaceResponseFromJson(Map<String, dynamic> json) =>
    SavePlaceResponse(
      saved: json['saved'] as bool,
      savesCount: (json['saves_count'] as num).toInt(),
    );

Map<String, dynamic> _$SavePlaceResponseToJson(SavePlaceResponse instance) =>
    <String, dynamic>{
      'saved': instance.saved,
      'saves_count': instance.savesCount,
    };
