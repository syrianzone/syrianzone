import 'package:json_annotation/json_annotation.dart';

part 'places_response.g.dart';

@JsonSerializable()
class PlacesResponse {
  @JsonKey(name: 'current_page')
  final int currentPage;
  final List<PlaceResponse> data;
  final int? from;
  @JsonKey(name: 'last_page')
  final int lastPage;
  @JsonKey(name: 'per_page')
  final int perPage;
  final int? to;
  final int total;

  PlacesResponse({
    required this.currentPage,
    required this.data,
    this.from,
    required this.lastPage,
    required this.perPage,
    this.to,
    required this.total,
  });

  factory PlacesResponse.fromJson(Map<String, dynamic> json) =>
      _$PlacesResponseFromJson(json);
}

@JsonSerializable()
class PlaceResponse {
  final int id;
  final String name;
  final String category;
  final String? description;
  final double lat;
  final double lng;
  @JsonKey(name: 'thumb_url')
  final String? thumbUrl;
  @JsonKey(name: 'saves_count')
  final int savesCount;

  PlaceResponse({
    required this.id,
    required this.name,
    required this.category,
    this.description,
    required this.lat,
    required this.lng,
    this.thumbUrl,
    this.savesCount = 0,
  });

  factory PlaceResponse.fromJson(Map<String, dynamic> json) =>
      _$PlaceResponseFromJson(json);
}
