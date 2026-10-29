// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'nearby_stop_response.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

NearbyStopResponse _$NearbyStopResponseFromJson(Map<String, dynamic> json) =>
    NearbyStopResponse(
      id: json['id'] as String,
      nameAr: json['nameAr'] as String,
      cityId: json['cityId'] as String,
      coordinates: (json['coordinates'] as List<dynamic>)
          .map((e) => (e as num).toDouble())
          .toList(),
      routes: (json['routes'] as List<dynamic>)
          .map((e) => e as Map<String, dynamic>)
          .toList(),
    );

Map<String, dynamic> _$NearbyStopResponseToJson(NearbyStopResponse instance) =>
    <String, dynamic>{
      'id': instance.id,
      'nameAr': instance.nameAr,
      'cityId': instance.cityId,
      'coordinates': instance.coordinates,
      'routes': instance.routes,
    };
