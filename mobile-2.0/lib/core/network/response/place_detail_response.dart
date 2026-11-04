import 'package:json_annotation/json_annotation.dart';

part 'place_detail_response.g.dart';

@JsonSerializable()
class PlaceDetailResponse {
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
  final String? status;
  final PlaceAuthor? user;
  final List<PlacePhotoItem> photos;
  @JsonKey(name: 'saved_by_me')
  final bool? savedByMe;
  @JsonKey(name: 'created_at')
  final String? createdAt;

  PlaceDetailResponse({
    required this.id,
    required this.name,
    required this.category,
    this.description,
    required this.lat,
    required this.lng,
    this.thumbUrl,
    this.savesCount = 0,
    this.status,
    this.user,
    this.photos = const [],
    this.savedByMe,
    this.createdAt,
  });

  factory PlaceDetailResponse.fromJson(Map<String, dynamic> json) =>
      _$PlaceDetailResponseFromJson(json);
}

@JsonSerializable()
class PlaceAuthor {
  final int id;
  final String name;
  @JsonKey(name: 'avatar_url')
  final String? avatarUrl;
  final int? level;
  final int? points;

  PlaceAuthor({
    required this.id,
    required this.name,
    this.avatarUrl,
    this.level,
    this.points,
  });

  factory PlaceAuthor.fromJson(Map<String, dynamic> json) =>
      _$PlaceAuthorFromJson(json);
}

@JsonSerializable()
class PlacePhotoItem {
  final int id;
  @JsonKey(name: 'thumb_url')
  final String? thumbUrl;
  @JsonKey(name: 'display_url')
  final String displayUrl;
  final int sort;

  PlacePhotoItem({
    required this.id,
    this.thumbUrl,
    required this.displayUrl,
    this.sort = 0,
  });

  factory PlacePhotoItem.fromJson(Map<String, dynamic> json) =>
      _$PlacePhotoItemFromJson(json);
}
