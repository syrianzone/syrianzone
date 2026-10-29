import 'package:flutter_osm_plugin/flutter_osm_plugin.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:syrianzone/core/data/model/lng_lat.dart';
import 'package:syrianzone/core/network/json_converter/geometry_converter.dart';

part 'new_transit_route_request_body.g.dart';

@JsonSerializable()
class NewTransitRouteRequestBody {
  @JsonKey(name: 'city_id')
  final String cityId;
  final String? routeId;
  @JsonKey(name: 'name_ar')
  final String nameAr;
  @JsonKey(name: 'name_en')
  final String nameEn;
  final int price;
  @JsonKey(name: 'color_index')
  final int colorIndex;
  final String notes;
  final NewTransitRouteGeoJson geojson;

  NewTransitRouteRequestBody({
    required this.cityId,
    this.routeId,
    required this.nameAr,
    required this.nameEn,
    required this.price,
    required this.colorIndex,
    required this.notes,
    required this.geojson,
  });

  factory NewTransitRouteRequestBody.fromJson(Map<String, dynamic> json) =>
      _$NewTransitRouteRequestBodyFromJson(json);

  Map<String, dynamic> toJson() => _$NewTransitRouteRequestBodyToJson(this);
}

@JsonSerializable()
class NewTransitRouteGeoJson {
  final String type;
  final List<NewTransitRouteFeature> features;

  NewTransitRouteGeoJson({required this.type, required this.features});

  factory NewTransitRouteGeoJson.fromJson(Map<String, dynamic> json) =>
      _$NewTransitRouteGeoJsonFromJson(json);

  Map<String, dynamic> toJson() => _$NewTransitRouteGeoJsonToJson(this);
}

@JsonSerializable()
class NewTransitRouteFeature {
  final String type;
  final NewTransitRouteProperties properties;
  final NewTransitRouteGeometry geometry;

  NewTransitRouteFeature({
    required this.type,
    required this.properties,
    required this.geometry,
  });

  factory NewTransitRouteFeature.fromJson(Map<String, dynamic> json) =>
      _$NewTransitRouteFeatureFromJson(json);

  Map<String, dynamic> toJson() => _$NewTransitRouteFeatureToJson(this);
}

@JsonSerializable()
class NewTransitRouteProperties {
  final String type;
  final String? nameAr;
  final String? nameEn;

  NewTransitRouteProperties({required this.type, this.nameAr, this.nameEn});

  factory NewTransitRouteProperties.fromJson(Map<String, dynamic> json) =>
      _$NewTransitRoutePropertiesFromJson(json);

  Map<String, dynamic> toJson() => _$NewTransitRoutePropertiesToJson(this);
}

@JsonSerializable()
class NewTransitRouteGeometry {
  final String type;
  @GeometryCoordinatesConverter()
  final Object coordinates;

  NewTransitRouteGeometry({required this.type, required this.coordinates});

  factory NewTransitRouteGeometry.lineString(List<LngLat> coordinates) =>
      NewTransitRouteGeometry(type: 'LineString', coordinates: coordinates);

  factory NewTransitRouteGeometry.point(LngLat coordinate) =>
      NewTransitRouteGeometry(type: 'Point', coordinates: coordinate);

  factory NewTransitRouteGeometry.fromJson(Map<String, dynamic> json) =>
      _$NewTransitRouteGeometryFromJson(json);

  Map<String, dynamic> toJson() => _$NewTransitRouteGeometryToJson(this);
}

extension GeoPointExtension on GeoPoint{
  LngLat toLngLat() {
    return LngLat(longitude: longitude, latitude: latitude);
  }
}