import 'package:json_annotation/json_annotation.dart';
import 'package:syrianzone/core/data/model/lng_lat.dart';
import 'package:syrianzone/core/data/model/map_feature_item.dart';
import 'package:syrianzone/core/network/json_converter/lng_lat_json_converter.dart';

part 'hotels_map_response.g.dart';

@JsonSerializable()
class HotelsMapResponse {
  final String type;
  final List<HotelMapFeature> features;

  HotelsMapResponse({
    required this.type,
    required this.features,
  });

  factory HotelsMapResponse.fromJson(Map<String, dynamic> json) =>
      _$HotelsMapResponseFromJson(json);
}

@JsonSerializable()
class HotelMapFeature implements MapFeatureItem {
  final String type;
  final HotelMapGeometry geometry;
  final HotelMapProperties properties;

  HotelMapFeature({
    required this.type,
    required this.geometry,
    required this.properties,
  });

  factory HotelMapFeature.fromJson(Map<String, dynamic> json) =>
      _$HotelMapFeatureFromJson(json);

  @override
  int get id => properties.id;

  @override
  double get latitude => geometry.latitude;

  @override
  double get longitude => geometry.longitude;

  @override
  String get displayName => properties.displayName;

  @override
  String get mapType => 'hotel';

  @override
  int? get userId => null;
}

@JsonSerializable()
class HotelMapGeometry {
  final String type;
  @LngLatConverter()
  final LngLat coordinates; // [lng, lat]

  HotelMapGeometry({
    required this.type,
    required this.coordinates,
  });

  factory HotelMapGeometry.fromJson(Map<String, dynamic> json) =>
      _$HotelMapGeometryFromJson(json);

  double get longitude => coordinates.longitude;
  double get latitude => coordinates.latitude;
}

@JsonSerializable()
class HotelMapProperties {
  final int id;
  final String name;
  @JsonKey(name: 'name_ar')
  final String? nameAr;
  final String? type;
  @JsonKey(name: 'star_rating')
  final int? starRating;
  @JsonKey(name: 'now_show_rate')
  final dynamic nowShowRate;
  final String? city;
  @JsonKey(name: 'city_ar')
  final String? cityAr;
  @JsonKey(name: 'thumb_url')
  final String? thumbUrl;
  final String? slug;

  HotelMapProperties({
    required this.id,
    required this.name,
    this.nameAr,
    this.type,
    this.starRating,
    this.nowShowRate,
    this.city,
    this.cityAr,
    this.thumbUrl,
    this.slug,
  });

  factory HotelMapProperties.fromJson(Map<String, dynamic> json) =>
      _$HotelMapPropertiesFromJson(json);

  String get displayName =>
      (nameAr != null && nameAr!.trim().isNotEmpty) ? nameAr! : name;
}
