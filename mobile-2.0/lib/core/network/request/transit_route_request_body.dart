import 'package:flutter_osm_plugin/flutter_osm_plugin.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:syrianzone/core/data/model/lng_lat.dart';
import 'package:syrianzone/core/network/json_converter/geometry_converter.dart';

part 'transit_route_request_body.g.dart';

@JsonSerializable()
class TransitRouteRequestBody {
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
  final TransitRouteGeoJson geojson;

  TransitRouteRequestBody({
    required this.cityId,
    this.routeId,
    required this.nameAr,
    required this.nameEn,
    required this.price,
    required this.colorIndex,
    required this.notes,
    required this.geojson,
  });

  factory TransitRouteRequestBody.fromJson(Map<String, dynamic> json) =>
      _$TransitRouteRequestBodyFromJson(json);

  Map<String, dynamic> toJson() => _$TransitRouteRequestBodyToJson(this);
}

@JsonSerializable()
class TransitRouteGeoJson {
  final String type;
  final List<TransitRouteFeature> features;

  TransitRouteGeoJson({required this.type, required this.features});

  factory TransitRouteGeoJson.fromJson(Map<String, dynamic> json) =>
      _$TransitRouteGeoJsonFromJson(json);

  Map<String, dynamic> toJson() => _$TransitRouteGeoJsonToJson(this);
}

@JsonSerializable()
class TransitRouteFeature {
  final String type;
  final TransitRouteProperties properties;
  final TransitRouteGeometry geometry;

  TransitRouteFeature({
    required this.type,
    required this.properties,
    required this.geometry,
  });

  factory TransitRouteFeature.fromJson(Map<String, dynamic> json) =>
      _$TransitRouteFeatureFromJson(json);

  Map<String, dynamic> toJson() => _$TransitRouteFeatureToJson(this);
}

@JsonSerializable()
class TransitRouteProperties {
  final String type;
  final String? nameAr;
  final String? nameEn;

  TransitRouteProperties({required this.type, this.nameAr, this.nameEn});

  factory TransitRouteProperties.fromJson(Map<String, dynamic> json) =>
      _$TransitRoutePropertiesFromJson(json);

  Map<String, dynamic> toJson() => _$TransitRoutePropertiesToJson(this);
}

@JsonSerializable()
class TransitRouteGeometry {
  final String type;
  @GeometryCoordinatesConverter()
  final Object coordinates;

  TransitRouteGeometry({required this.type, required this.coordinates});

  factory TransitRouteGeometry.lineString(List<LngLat> coordinates) =>
      TransitRouteGeometry(type: 'LineString', coordinates: coordinates);

  factory TransitRouteGeometry.point(LngLat coordinate) =>
      TransitRouteGeometry(type: 'Point', coordinates: coordinate);

  factory TransitRouteGeometry.fromJson(Map<String, dynamic> json) =>
      _$TransitRouteGeometryFromJson(json);

  Map<String, dynamic> toJson() => _$TransitRouteGeometryToJson(this);
}

extension GeoPointExtension on GeoPoint{
  LngLat toLngLat() {
    return LngLat(longitude: longitude, latitude: latitude);
  }
}