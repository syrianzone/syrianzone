// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'new_transit_route_request_body.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

NewTransitRouteRequestBody _$NewTransitRouteRequestBodyFromJson(
  Map<String, dynamic> json,
) => NewTransitRouteRequestBody(
  cityId: json['city_id'] as String,
  routeId: json['routeId'] as String?,
  nameAr: json['name_ar'] as String,
  nameEn: json['name_en'] as String,
  price: (json['price'] as num).toInt(),
  colorIndex: (json['color_index'] as num).toInt(),
  notes: json['notes'] as String,
  geojson: NewTransitRouteGeoJson.fromJson(
    json['geojson'] as Map<String, dynamic>,
  ),
);

Map<String, dynamic> _$NewTransitRouteRequestBodyToJson(
  NewTransitRouteRequestBody instance,
) => <String, dynamic>{
  'city_id': instance.cityId,
  'routeId': instance.routeId,
  'name_ar': instance.nameAr,
  'name_en': instance.nameEn,
  'price': instance.price,
  'color_index': instance.colorIndex,
  'notes': instance.notes,
  'geojson': instance.geojson,
};

NewTransitRouteGeoJson _$NewTransitRouteGeoJsonFromJson(
  Map<String, dynamic> json,
) => NewTransitRouteGeoJson(
  type: json['type'] as String,
  features: (json['features'] as List<dynamic>)
      .map((e) => NewTransitRouteFeature.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$NewTransitRouteGeoJsonToJson(
  NewTransitRouteGeoJson instance,
) => <String, dynamic>{'type': instance.type, 'features': instance.features};

NewTransitRouteFeature _$NewTransitRouteFeatureFromJson(
  Map<String, dynamic> json,
) => NewTransitRouteFeature(
  type: json['type'] as String,
  properties: NewTransitRouteProperties.fromJson(
    json['properties'] as Map<String, dynamic>,
  ),
  geometry: NewTransitRouteGeometry.fromJson(
    json['geometry'] as Map<String, dynamic>,
  ),
);

Map<String, dynamic> _$NewTransitRouteFeatureToJson(
  NewTransitRouteFeature instance,
) => <String, dynamic>{
  'type': instance.type,
  'properties': instance.properties,
  'geometry': instance.geometry,
};

NewTransitRouteProperties _$NewTransitRoutePropertiesFromJson(
  Map<String, dynamic> json,
) => NewTransitRouteProperties(
  type: json['type'] as String,
  nameAr: json['nameAr'] as String?,
  nameEn: json['nameEn'] as String?,
);

Map<String, dynamic> _$NewTransitRoutePropertiesToJson(
  NewTransitRouteProperties instance,
) => <String, dynamic>{
  'type': instance.type,
  'nameAr': instance.nameAr,
  'nameEn': instance.nameEn,
};

NewTransitRouteGeometry _$NewTransitRouteGeometryFromJson(
  Map<String, dynamic> json,
) => NewTransitRouteGeometry(
  type: json['type'] as String,
  coordinates: const GeometryCoordinatesConverter().fromJson(
    json['coordinates'],
  ),
);

Map<String, dynamic> _$NewTransitRouteGeometryToJson(
  NewTransitRouteGeometry instance,
) => <String, dynamic>{
  'type': instance.type,
  'coordinates': const GeometryCoordinatesConverter().toJson(
    instance.coordinates,
  ),
};
