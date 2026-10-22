import 'package:json_annotation/json_annotation.dart';

part 'transit_search_response.g.dart';

@JsonSerializable()
class TransitSearchResponse { 
  final List<TransitSearchRoute> routes;
  final List<TransitSearchStop> stops;

  TransitSearchResponse({
    required this.routes,
    required this.stops,
  });

  factory TransitSearchResponse.fromJson(Map<String, dynamic> json) =>
      _$TransitSearchResponseFromJson(json);
  
}
@JsonSerializable()
class TransitSearchRoute{
  final String type;
  final String id;
  final String nameAr;
  final String? nameEn;
  final String cityId;

  TransitSearchRoute({
    required this.type,
    required this.id,
    required this.nameAr,
    this.nameEn,
    required this.cityId,
  });

  factory TransitSearchRoute.fromJson(Map<String, dynamic> json) =>
      _$TransitSearchRouteFromJson(json);

  
}

@JsonSerializable()
class TransitSearchStop{
  final String type;
  final String id;
  final String nameAr;
  final String cityId;
  final List<double> coordinates;

  TransitSearchStop({
    required this.type,
    required this.id,
    required this.nameAr,
    required this.coordinates,
    required this.cityId,
  });

  factory TransitSearchStop.fromJson(Map<String, dynamic> json) =>
      _$TransitSearchStopFromJson(json);

}