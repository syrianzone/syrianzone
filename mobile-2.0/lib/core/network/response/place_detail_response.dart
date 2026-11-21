import 'package:freezed_annotation/freezed_annotation.dart';

part 'place_detail_response.freezed.dart';
part 'place_detail_response.g.dart';

@freezed
sealed class PlaceDetailResponse with _$PlaceDetailResponse {
  const factory PlaceDetailResponse({
    required int id,
    required String name,
    required String category,
    String? description,
    required double lat,
    required double lng,
    @JsonKey(name: 'thumb_url') String? thumbUrl,
    @Default(0) @JsonKey(name: 'saves_count') int savesCount,
    String? status,
    PlaceAuthor? user,
    @Default([]) List<PlacePhotoItem> photos,
    @JsonKey(name: 'saved_by_me') bool? savedByMe,
    @JsonKey(name: 'created_at') String? createdAt,
  }) = _PlaceDetailResponse;

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

  Map<String, dynamic> toJson() => _$PlaceAuthorToJson(this);
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

  Map<String, dynamic> toJson() => _$PlacePhotoItemToJson(this);
}
