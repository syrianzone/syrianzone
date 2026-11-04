import 'package:json_annotation/json_annotation.dart';

part 'places_map_response.g.dart';

@JsonSerializable()
class PlacesMapResponse {
  final String type;
  final List<PlaceMapFeature> features;

  PlacesMapResponse({
    required this.type,
    required this.features,
  });

  factory PlacesMapResponse.fromJson(Map<String, dynamic> json) =>
      _$PlacesMapResponseFromJson(json);
}

@JsonSerializable()
class PlaceMapFeature {
  final String type;
  final PlaceMapGeometry geometry;
  final PlaceMapProperties properties;

  PlaceMapFeature({
    required this.type,
    required this.geometry,
    required this.properties,
  });

  factory PlaceMapFeature.fromJson(Map<String, dynamic> json) =>
      _$PlaceMapFeatureFromJson(json);
}

@JsonSerializable()
class PlaceMapGeometry {
  final String type;
  //TODO USE LNGLAT CONVERTER 
  final List<double> coordinates; // [lng, lat]

  PlaceMapGeometry({
    required this.type,
    required this.coordinates,
  });

  factory PlaceMapGeometry.fromJson(Map<String, dynamic> json) =>
      _$PlaceMapGeometryFromJson(json);

  double get longitude => coordinates.isNotEmpty ? coordinates[0] : 0.0;
  double get latitude => coordinates.length > 1 ? coordinates[1] : 0.0;
}

@JsonSerializable()
class PlaceMapProperties {
  final int id;
  final String name;
  final String? category;
  @JsonKey(name: 'thumb_url')
  final String? thumbUrl;
  @JsonKey(name: 'user_id')
  final int? userId;
  final String? type; // 'hotel' for hotel map points

  PlaceMapProperties({
    required this.id,
    required this.name,
    this.category,
    this.thumbUrl,
    this.userId,
    this.type,
  });

  factory PlaceMapProperties.fromJson(Map<String, dynamic> json) =>
      _$PlaceMapPropertiesFromJson(json);
}
