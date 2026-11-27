import 'package:json_annotation/json_annotation.dart';
import 'package:latlong2/latlong.dart';

part 'lng_lat.g.dart';

@JsonSerializable()
class LngLat {
  final double longitude;
  final double latitude;

  LngLat({
    required this.longitude,
    required this.latitude,
  });

  factory LngLat.fromJson(Map<String, dynamic> json) => _$LngLatFromJson(json);
  Map<String, dynamic> toJson() => _$LngLatToJson(this);
}

extension LngLatExtension on LngLat {
  LatLng toLatLng() {
    return LatLng(latitude, longitude);
  }

  // Alias for backward compatibility
  LatLng toGeoPoint() => toLatLng();
}

extension LatLngExtension on LatLng {
  LngLat toLngLat() {
    return LngLat(longitude: longitude, latitude: latitude);
  }
}
