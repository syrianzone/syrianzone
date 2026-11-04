import 'package:flutter_osm_plugin/flutter_osm_plugin.dart';
import 'package:json_annotation/json_annotation.dart';

part 'lng_lat.g.dart';

@JsonSerializable()
class LngLat{
  final double longitude;
  final double latitude;

  LngLat({
    required this.longitude,
    required this.latitude,
  });
  factory LngLat.fromJson(Map<String, dynamic> json) => _$LngLatFromJson(json);
}



extension LngLatExtension on LngLat {
  GeoPoint toGeoPoint() {
    return GeoPoint(latitude: latitude, longitude: longitude);
  }
}