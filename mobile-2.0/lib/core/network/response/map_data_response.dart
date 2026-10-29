import 'package:json_annotation/json_annotation.dart';

part 'map_data_response.g.dart';

@JsonSerializable()
class MapDataResponse {
  final MapRouteFeatureCollection routes;
  final MapStopFeatureCollection stops;

  MapDataResponse({required this.routes, required this.stops});

  factory MapDataResponse.fromJson(Map<String, dynamic> json) =>
      _$MapDataResponseFromJson(json);

}

@JsonSerializable()
class MapRouteFeatureCollection {
  @JsonKey(defaultValue: 'FeatureCollection')
  final String type;
  @JsonKey(defaultValue: <MapRouteFeature>[])
  final List<MapRouteFeature> features;

  MapRouteFeatureCollection({required this.type, required this.features});

  factory MapRouteFeatureCollection.fromJson(Map<String, dynamic> json) =>
      _$MapRouteFeatureCollectionFromJson(json);

}

@JsonSerializable()
class MapStopFeatureCollection {
  @JsonKey(defaultValue: 'FeatureCollection')
  final String type;
  @JsonKey(defaultValue: <MapStopFeature>[])
  final List<MapStopFeature> features;

  MapStopFeatureCollection({required this.type, required this.features});

  factory MapStopFeatureCollection.fromJson(Map<String, dynamic> json) =>
      _$MapStopFeatureCollectionFromJson(json);

}

@JsonSerializable()
class MapRouteFeature {
  @JsonKey(defaultValue: 'Feature')
  final String type;
  final MapLineStringGeometry geometry;
  final MapRouteProperties properties;

  MapRouteFeature({
    required this.type,
    required this.geometry,
    required this.properties,
  });

  factory MapRouteFeature.fromJson(Map<String, dynamic> json) =>
      _$MapRouteFeatureFromJson(json);

}

@JsonSerializable()
class MapStopFeature {
  @JsonKey(defaultValue: 'Feature')
  final String type;
  final MapPointGeometry geometry;
  final MapStopProperties properties;

  MapStopFeature({
    required this.type,
    required this.geometry,
    required this.properties,
  });

  factory MapStopFeature.fromJson(Map<String, dynamic> json) =>
      _$MapStopFeatureFromJson(json);

}

@JsonSerializable()
class MapLineStringGeometry {
  @JsonKey(defaultValue: 'LineString')
  final String type;
  @JsonKey(defaultValue: <List<double>>[])
  final List<List<double>> coordinates;

  MapLineStringGeometry({required this.type, required this.coordinates});

  factory MapLineStringGeometry.fromJson(Map<String, dynamic> json) =>
      _$MapLineStringGeometryFromJson(json);

}

@JsonSerializable()
class MapPointGeometry {
  @JsonKey(defaultValue: 'Point')
  final String type;
  @JsonKey(defaultValue: <double>[])
  final List<double> coordinates;

  MapPointGeometry({required this.type, required this.coordinates});

  factory MapPointGeometry.fromJson(Map<String, dynamic> json) =>
      _$MapPointGeometryFromJson(json);

}

@JsonSerializable()
class MapRouteProperties {
  @JsonKey(defaultValue: '')
  final String id;
  @JsonKey(defaultValue: '')
  final String nameAr;
  final String? nameEn;
  @JsonKey(
    readValue: _readColorIndex,
    fromJson: _colorIndexFromJson,
    defaultValue: 0,
  )
  final int colorIndex;
  final int? priceOld;
  final int? priceNew;

  MapRouteProperties({
    required this.id,
    required this.nameAr,
    this.nameEn,
    required this.colorIndex,
    this.priceOld,
    this.priceNew,
  });

  static Object? _readColorIndex(Map<dynamic, dynamic> json, String _) {
    return json['colorIndex'] ?? json['color_index'];
  }

  static int _colorIndexFromJson(Object? value) {
    return (value as num?)?.toInt() ?? 0;
  }

  factory MapRouteProperties.fromJson(Map<String, dynamic> json) =>
      _$MapRoutePropertiesFromJson(json);

}

@JsonSerializable()
class MapStopProperties {
  @JsonKey(defaultValue: '')
  final String id;
  @JsonKey(defaultValue: '')
  final String nameAr;
  @JsonKey(defaultValue: <String>[])
  final List<String> routeIds;

  MapStopProperties({
    required this.id,
    required this.nameAr,
    required this.routeIds,
  });

  factory MapStopProperties.fromJson(Map<String, dynamic> json) =>
      _$MapStopPropertiesFromJson(json);

}