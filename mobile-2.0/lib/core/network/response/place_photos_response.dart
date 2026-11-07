import 'package:json_annotation/json_annotation.dart';

part 'place_photos_response.g.dart';

@JsonSerializable()
class PlacePhotosResponse {
  @JsonKey(name: 'current_page')
  final int currentPage;
  final List<PlacePhotoFeedItem> data;
  @JsonKey(name: 'last_page')
  final int lastPage;
  final int total;

  PlacePhotosResponse({
    required this.currentPage,
    required this.data,
    required this.lastPage,
    this.total = 0,
  });

  factory PlacePhotosResponse.fromJson(Map<String, dynamic> json) =>
      _$PlacePhotosResponseFromJson(json);

  Map<String, dynamic> toJson() => _$PlacePhotosResponseToJson(this);
}

@JsonSerializable()
class PlacePhotoFeedItem {
  final int id;
  @JsonKey(name: 'thumb_url')
  final String? thumbUrl;
  @JsonKey(name: 'display_url')
  final String? displayUrl;
  final PlacePhotoEmbeddedPlace place;

  PlacePhotoFeedItem({
    required this.id,
    this.thumbUrl,
    this.displayUrl,
    required this.place,
  });

  factory PlacePhotoFeedItem.fromJson(Map<String, dynamic> json) =>
      _$PlacePhotoFeedItemFromJson(json);

  Map<String, dynamic> toJson() => _$PlacePhotoFeedItemToJson(this);
}

@JsonSerializable()
class PlacePhotoEmbeddedPlace {
  final int id;
  final String name;
  final String category;
  final double lat;
  final double lng;

  PlacePhotoEmbeddedPlace({
    required this.id,
    required this.name,
    required this.category,
    required this.lat,
    required this.lng,
  });

  factory PlacePhotoEmbeddedPlace.fromJson(Map<String, dynamic> json) =>
      _$PlacePhotoEmbeddedPlaceFromJson(json);

  Map<String, dynamic> toJson() => _$PlacePhotoEmbeddedPlaceToJson(this);
}
