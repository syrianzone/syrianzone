import 'package:json_annotation/json_annotation.dart';
import 'package:syrianzone/core/network/request/transit_route_request_body.dart';

part 'user_submissions_response.g.dart';

@JsonSerializable()
class UserSubmissionsResponse {
  final List<RouteDraftItem> data;

  UserSubmissionsResponse({required this.data});

  factory UserSubmissionsResponse.fromJson(Map<String, dynamic> json) =>
      _$UserSubmissionsResponseFromJson(json);

  Map<String, dynamic> toJson() => _$UserSubmissionsResponseToJson(this);
}

@JsonSerializable()
class RouteDraftItem {
  final int id;
  @JsonKey(name: 'user_id')
  final int? userId;
  @JsonKey(name: 'route_id')
  final String? routeId;
  @JsonKey(name: 'city_id')
  final String cityId;
  @JsonKey(name: 'name_ar')
  final String nameAr;
  @JsonKey(name: 'name_en')
  final String? nameEn;
  final int? price;
  @JsonKey(name: 'color_index')
  final int? colorIndex;
  final String? notes;
  final String status;
  @JsonKey(name: 'rejection_reason')
  final String? rejectionReason;
  final TransitRouteGeoJson? geojson;
  final DraftCityResponse? city;
  @JsonKey(name: 'created_at')
  final String? createdAt;
  @JsonKey(name: 'updated_at')
  final String? updatedAt;

  RouteDraftItem({
    required this.id,
    this.userId,
    this.routeId,
    required this.cityId,
    required this.nameAr,
    this.nameEn,
    this.price,
    this.colorIndex,
    this.notes,
    required this.status,
    this.rejectionReason,
    this.geojson,
    this.city,
    this.createdAt,
    this.updatedAt,
  });

  factory RouteDraftItem.fromJson(Map<String, dynamic> json) =>
      _$RouteDraftItemFromJson(json);

  Map<String, dynamic> toJson() => _$RouteDraftItemToJson(this);
}

@JsonSerializable()
class DraftCityResponse {
  final String id;
  @JsonKey(name: 'name_ar')
  final String nameAr;
  @JsonKey(name: 'name_en')
  final String? nameEn;

  DraftCityResponse({
    required this.id,
    required this.nameAr,
    this.nameEn,
  });

  factory DraftCityResponse.fromJson(Map<String, dynamic> json) =>
      _$DraftCityResponseFromJson(json);

  Map<String, dynamic> toJson() => _$DraftCityResponseToJson(this);
}
