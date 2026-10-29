// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'transit_search_response.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

TransitSearchResponse _$TransitSearchResponseFromJson(
  Map<String, dynamic> json,
) => TransitSearchResponse(
  routes: (json['routes'] as List<dynamic>)
      .map((e) => TransitSearchRoute.fromJson(e as Map<String, dynamic>))
      .toList(),
  stops: (json['stops'] as List<dynamic>)
      .map((e) => TransitSearchStop.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$TransitSearchResponseToJson(
  TransitSearchResponse instance,
) => <String, dynamic>{'routes': instance.routes, 'stops': instance.stops};

TransitSearchRoute _$TransitSearchRouteFromJson(Map<String, dynamic> json) =>
    TransitSearchRoute(
      type: json['type'] as String,
      id: json['id'] as String,
      nameAr: json['nameAr'] as String,
      nameEn: json['nameEn'] as String?,
      cityId: json['cityId'] as String,
    );

Map<String, dynamic> _$TransitSearchRouteToJson(TransitSearchRoute instance) =>
    <String, dynamic>{
      'type': instance.type,
      'id': instance.id,
      'nameAr': instance.nameAr,
      'nameEn': instance.nameEn,
      'cityId': instance.cityId,
    };

TransitSearchStop _$TransitSearchStopFromJson(Map<String, dynamic> json) =>
    TransitSearchStop(
      type: json['type'] as String,
      id: json['id'] as String,
      nameAr: json['nameAr'] as String,
      coordinates: (json['coordinates'] as List<dynamic>)
          .map((e) => (e as num).toDouble())
          .toList(),
      cityId: json['cityId'] as String,
    );

Map<String, dynamic> _$TransitSearchStopToJson(TransitSearchStop instance) =>
    <String, dynamic>{
      'type': instance.type,
      'id': instance.id,
      'nameAr': instance.nameAr,
      'cityId': instance.cityId,
      'coordinates': instance.coordinates,
    };
