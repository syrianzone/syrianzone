// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'transit_route_request_body.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

TransitRouteRequestBody _$TransitRouteRequestBodyFromJson(
  Map<String, dynamic> json,
) => TransitRouteRequestBody(
  cityId: json['city_id'] as String,
  routeId: json['routeId'] as String?,
  nameAr: json['name_ar'] as String,
  nameEn: json['name_en'] as String,
  price: (json['price'] as num).toInt(),
  colorIndex: (json['color_index'] as num).toInt(),
  notes: json['notes'] as String,
  geojson: TransitRouteGeoJson.fromJson(
    json['geojson'] as Map<String, dynamic>,
  ),
);

Map<String, dynamic> _$TransitRouteRequestBodyToJson(
  TransitRouteRequestBody instance,
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

TransitRouteGeoJson _$TransitRouteGeoJsonFromJson(Map<String, dynamic> json) =>
    TransitRouteGeoJson(
      type: json['type'] as String,
      features: (json['features'] as List<dynamic>)
          .map((e) => TransitRouteFeature.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$TransitRouteGeoJsonToJson(
  TransitRouteGeoJson instance,
) => <String, dynamic>{'type': instance.type, 'features': instance.features};

TransitRouteFeature _$TransitRouteFeatureFromJson(Map<String, dynamic> json) =>
    TransitRouteFeature(
      type: json['type'] as String,
      properties: TransitRouteProperties.fromJson(
        json['properties'] as Map<String, dynamic>,
      ),
      geometry: TransitRouteGeometry.fromJson(
        json['geometry'] as Map<String, dynamic>,
      ),
    );

Map<String, dynamic> _$TransitRouteFeatureToJson(
  TransitRouteFeature instance,
) => <String, dynamic>{
  'type': instance.type,
  'properties': instance.properties,
  'geometry': instance.geometry,
};

TransitRouteProperties _$TransitRoutePropertiesFromJson(
  Map<String, dynamic> json,
) => TransitRouteProperties(
  type: json['type'] as String,
  nameAr: json['nameAr'] as String?,
  nameEn: json['nameEn'] as String?,
);

Map<String, dynamic> _$TransitRoutePropertiesToJson(
  TransitRouteProperties instance,
) => <String, dynamic>{
  'type': instance.type,
  'nameAr': instance.nameAr,
  'nameEn': instance.nameEn,
};

TransitRouteGeometry _$TransitRouteGeometryFromJson(
  Map<String, dynamic> json,
) => TransitRouteGeometry(
  type: json['type'] as String,
  coordinates: const GeometryCoordinatesConverter().fromJson(
    json['coordinates'],
  ),
);

Map<String, dynamic> _$TransitRouteGeometryToJson(
  TransitRouteGeometry instance,
) => <String, dynamic>{
  'type': instance.type,
  'coordinates': const GeometryCoordinatesConverter().toJson(
    instance.coordinates,
  ),
};
