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

MapRouteFeature _$MapRouteFeatureFromJson(Map<String, dynamic> json) =>
    MapRouteFeature(
      type: json['type'] as String? ?? 'Feature',
      geometry: MapRouteGeometry.fromJson(
        json['geometry'] as Map<String, dynamic>,
      ),
      properties: MapRouteProperties.fromJson(
        json['properties'] as Map<String, dynamic>,
      ),
    );

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

MapRouteGeometry _$MapRouteGeometryFromJson(Map<String, dynamic> json) =>
    MapRouteGeometry(
      type: json['type'] as String? ?? 'LineString',
      coordinates: const GeometryCoordinatesConverter().fromJson(
        json['coordinates'],
      ),
    );

MapPointGeometry _$MapPointGeometryFromJson(Map<String, dynamic> json) =>
    MapPointGeometry(
      type: json['type'] as String? ?? 'Point',
      coordinates:
          (json['coordinates'] as List<dynamic>?)
              ?.map((e) => (e as num).toDouble())
              .toList() ??
          [],
    );

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
