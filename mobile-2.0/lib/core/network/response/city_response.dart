import 'package:freezed_annotation/freezed_annotation.dart';

part 'city_response.g.dart';

@JsonSerializable()
class CityResponse {
  final String id;
  final String nameAr;
  final String nameEn;
  final String status;
  final double zoom;
  final List<double> center;
  final List<List<double>> bounds;
  final int routeCount;
  final CityIcon icon;



  CityResponse({
    required this.id,
    required this.nameAr,
    required this.nameEn,
    required this.status,
    required this.zoom,
    required this.center,
    required this.bounds,
    required this.routeCount,
    required this.icon,
  });

  factory CityResponse.fromJson(Map<String, dynamic> json) => _$CityResponseFromJson(json);

}

@JsonSerializable()
class CityIcon{
  final String viewBox;
  final String path;

  CityIcon({
    required this.viewBox,
    required this.path,
  });

  factory CityIcon.fromJson(Map<String, dynamic> json) => _$CityIconFromJson(json);
}

