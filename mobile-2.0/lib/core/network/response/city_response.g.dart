// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'city_response.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CityResponse _$CityResponseFromJson(Map<String, dynamic> json) => CityResponse(
  id: json['id'] as String,
  nameAr: json['nameAr'] as String,
  nameEn: json['nameEn'] as String,
  status: json['status'] as String,
  zoom: (json['zoom'] as num).toDouble(),
  center: (json['center'] as List<dynamic>)
      .map((e) => (e as num).toDouble())
      .toList(),
  bounds: (json['bounds'] as List<dynamic>)
      .map(
        (e) => (e as List<dynamic>).map((e) => (e as num).toDouble()).toList(),
      )
      .toList(),
  routeCount: (json['routeCount'] as num).toInt(),
  icon: CityIcon.fromJson(json['icon'] as Map<String, dynamic>),
);

Map<String, dynamic> _$CityResponseToJson(CityResponse instance) =>
    <String, dynamic>{
      'id': instance.id,
      'nameAr': instance.nameAr,
      'nameEn': instance.nameEn,
      'status': instance.status,
      'zoom': instance.zoom,
      'center': instance.center,
      'bounds': instance.bounds,
      'routeCount': instance.routeCount,
      'icon': instance.icon,
    };

CityIcon _$CityIconFromJson(Map<String, dynamic> json) =>
    CityIcon(viewBox: json['viewBox'] as String, path: json['path'] as String);

Map<String, dynamic> _$CityIconToJson(CityIcon instance) => <String, dynamic>{
  'viewBox': instance.viewBox,
  'path': instance.path,
};
