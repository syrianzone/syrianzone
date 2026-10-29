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
  center: const LngLatConverter().fromJson(json['center']),
  bounds: const LngLatListConverter().fromJson(json['bounds']),
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
      'center': const LngLatConverter().toJson(instance.center),
      'bounds': const LngLatListConverter().toJson(instance.bounds),
      'routeCount': instance.routeCount,
      'icon': instance.icon,
    };

CityIcon _$CityIconFromJson(Map<String, dynamic> json) =>
    CityIcon(viewBox: json['viewBox'] as String, path: json['path'] as String);

Map<String, dynamic> _$CityIconToJson(CityIcon instance) => <String, dynamic>{
  'viewBox': instance.viewBox,
  'path': instance.path,
};
