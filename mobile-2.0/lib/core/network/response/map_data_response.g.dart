// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'map_data_response.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MapDataResponse _$MapDataResponseFromJson(Map<String, dynamic> json) =>
    MapDataResponse(
      routes: MapRouteFeatureCollection.fromJson(
        json['routes'] as Map<String, dynamic>,
      ),
      stops: MapStopFeatureCollection.fromJson(
        json['stops'] as Map<String, dynamic>,
      ),
    );

Map<String, dynamic> _$MapDataResponseToJson(MapDataResponse instance) =>
    <String, dynamic>{'routes': instance.routes, 'stops': instance.stops};

MapRouteFeatureCollection _$MapRouteFeatureCollectionFromJson(
  Map<String, dynamic> json,
) => MapRouteFeatureCollection(
  type: json['type'] as String? ?? 'FeatureCollection',
  features:
      (json['features'] as List<dynamic>?)
          ?.map((e) => MapRouteFeature.fromJson(e as Map<String, dynamic>))
          .toList() ??
      [],
);

Map<String, dynamic> _$MapRouteFeatureCollectionToJson(
  MapRouteFeatureCollection instance,
) => <String, dynamic>{'type': instance.type, 'features': instance.features};

MapStopFeatureCollection _$MapStopFeatureCollectionFromJson(
  Map<String, dynamic> json,
) => MapStopFeatureCollection(
  type: json['type'] as String? ?? 'FeatureCollection',
  features:
      (json['features'] as List<dynamic>?)
          ?.map((e) => MapStopFeature.fromJson(e as Map<String, dynamic>))
          .toList() ??
      [],
);

Map<String, dynamic> _$MapStopFeatureCollectionToJson(
  MapStopFeatureCollection instance,
) => <String, dynamic>{'type': instance.type, 'features': instance.features};

MapRouteFeature _$MapRouteFeatureFromJson(Map<String, dynamic> json) =>
    MapRouteFeature(
      type: json['type'] as String? ?? 'Feature',
      geometry: MapLineStringGeometry.fromJson(
        json['geometry'] as Map<String, dynamic>,
      ),
      properties: MapRouteProperties.fromJson(
        json['properties'] as Map<String, dynamic>,
      ),
    );

Map<String, dynamic> _$MapRouteFeatureToJson(MapRouteFeature instance) =>
    <String, dynamic>{
      'type': instance.type,
      'geometry': instance.geometry,
      'properties': instance.properties,
    };

MapStopFeature _$MapStopFeatureFromJson(Map<String, dynamic> json) =>
    MapStopFeature(
      type: json['type'] as String? ?? 'Feature',
      geometry: MapPointGeometry.fromJson(
        json['geometry'] as Map<String, dynamic>,
      ),
      properties: MapStopProperties.fromJson(
        json['properties'] as Map<String, dynamic>,
      ),
    );

Map<String, dynamic> _$MapStopFeatureToJson(MapStopFeature instance) =>
    <String, dynamic>{
      'type': instance.type,
      'geometry': instance.geometry,
      'properties': instance.properties,
    };

MapLineStringGeometry _$MapLineStringGeometryFromJson(
  Map<String, dynamic> json,
) => MapLineStringGeometry(
  type: json['type'] as String? ?? 'LineString',
  coordinates:
      (json['coordinates'] as List<dynamic>?)
          ?.map(
            (e) =>
                (e as List<dynamic>).map((e) => (e as num).toDouble()).toList(),
          )
          .toList() ??
      [],
);

Map<String, dynamic> _$MapLineStringGeometryToJson(
  MapLineStringGeometry instance,
) => <String, dynamic>{
  'type': instance.type,
  'coordinates': instance.coordinates,
};

MapPointGeometry _$MapPointGeometryFromJson(Map<String, dynamic> json) =>
    MapPointGeometry(
      type: json['type'] as String? ?? 'Point',
      coordinates:
          (json['coordinates'] as List<dynamic>?)
              ?.map((e) => (e as num).toDouble())
              .toList() ??
          [],
    );

Map<String, dynamic> _$MapPointGeometryToJson(MapPointGeometry instance) =>
    <String, dynamic>{
      'type': instance.type,
      'coordinates': instance.coordinates,
    };

MapRouteProperties _$MapRoutePropertiesFromJson(Map<String, dynamic> json) =>
    MapRouteProperties(
      id: json['id'] as String? ?? '',
      nameAr: json['nameAr'] as String? ?? '',
      nameEn: json['nameEn'] as String?,
      colorIndex: MapRouteProperties._readColorIndex(json, 'colorIndex') == null
          ? 0
          : MapRouteProperties._colorIndexFromJson(
              MapRouteProperties._readColorIndex(json, 'colorIndex'),
            ),
      priceOld: (json['priceOld'] as num?)?.toInt(),
      priceNew: (json['priceNew'] as num?)?.toInt(),
    );

Map<String, dynamic> _$MapRoutePropertiesToJson(MapRouteProperties instance) =>
    <String, dynamic>{
      'id': instance.id,
      'nameAr': instance.nameAr,
      'nameEn': instance.nameEn,
      'colorIndex': instance.colorIndex,
      'priceOld': instance.priceOld,
      'priceNew': instance.priceNew,
    };

MapStopProperties _$MapStopPropertiesFromJson(Map<String, dynamic> json) =>
    MapStopProperties(
      id: json['id'] as String? ?? '',
      nameAr: json['nameAr'] as String? ?? '',
      routeIds:
          (json['routeIds'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          [],
    );

Map<String, dynamic> _$MapStopPropertiesToJson(MapStopProperties instance) =>
    <String, dynamic>{
      'id': instance.id,
      'nameAr': instance.nameAr,
      'routeIds': instance.routeIds,
    };
