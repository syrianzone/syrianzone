import 'package:json_annotation/json_annotation.dart';
import 'package:syrianzone/core/data/model/lng_lat.dart';
import 'package:syrianzone/core/network/json_converter/geometry_converter.dart';

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
  final MapRouteGeometry geometry;
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
class MapRouteGeometry {
  @JsonKey(defaultValue: 'LineString')
  final String type;

  @GeometryCoordinatesConverter()
  final Object coordinates;

  MapRouteGeometry({
    required this.type,
    required this.coordinates,
  });

  factory MapRouteGeometry.lineString(List<LngLat> coordinates) =>
      MapRouteGeometry(type: 'LineString', coordinates: coordinates);

  factory MapRouteGeometry.multiLineString(List<List<LngLat>> segments) =>
      MapRouteGeometry(type: 'MultiLineString', coordinates: segments);

  factory MapRouteGeometry.fromJson(Map<String, dynamic> json) =>
      _$MapRouteGeometryFromJson(json);

  List<List<LngLat>> get segments {
    if (coordinates is List<List<LngLat>>) {
      return coordinates as List<List<LngLat>>;
    } else if (coordinates is List<LngLat>) {
      return [coordinates as List<LngLat>];
    }
    return const [];
  }
}

typedef MapLineStringGeometry = MapRouteGeometry;

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