import 'package:freezed_annotation/freezed_annotation.dart';

part 'nearby_stop_response.g.dart';

@JsonSerializable()
class NearbyStopResponse {

  final String id;
  final String nameAr;
  final String cityId;
  final List<double> coordinates;
  final List<Map<String, dynamic>> routes;

  NearbyStopResponse({
    required this.id,
    required this.nameAr,
    required this.cityId,
    required this.coordinates,
    required this.routes,
  });

  factory NearbyStopResponse.fromJson(Map<String, dynamic> json) =>
      _$NearbyStopResponseFromJson(json);
}