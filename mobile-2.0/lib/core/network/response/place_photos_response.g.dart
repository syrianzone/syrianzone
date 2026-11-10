// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'place_photos_response.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PlacePhotosResponse _$PlacePhotosResponseFromJson(Map<String, dynamic> json) =>
    PlacePhotosResponse(
      currentPage: (json['current_page'] as num).toInt(),
      data: (json['data'] as List<dynamic>)
          .map((e) => PlacePhotoFeedItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      lastPage: (json['last_page'] as num).toInt(),
      total: (json['total'] as num?)?.toInt() ?? 0,
    );

Map<String, dynamic> _$PlacePhotosResponseToJson(
  PlacePhotosResponse instance,
) => <String, dynamic>{
  'current_page': instance.currentPage,
  'data': instance.data,
  'last_page': instance.lastPage,
  'total': instance.total,
};

PlacePhotoFeedItem _$PlacePhotoFeedItemFromJson(Map<String, dynamic> json) =>
    PlacePhotoFeedItem(
      id: (json['id'] as num).toInt(),
      thumbUrl: json['thumb_url'] as String?,
      displayUrl: json['display_url'] as String?,
      place: PlacePhotoEmbeddedPlace.fromJson(
        json['place'] as Map<String, dynamic>,
      ),
    );

Map<String, dynamic> _$PlacePhotoFeedItemToJson(PlacePhotoFeedItem instance) =>
    <String, dynamic>{
      'id': instance.id,
      'thumb_url': instance.thumbUrl,
      'display_url': instance.displayUrl,
      'place': instance.place,
    };

PlacePhotoEmbeddedPlace _$PlacePhotoEmbeddedPlaceFromJson(
  Map<String, dynamic> json,
) => PlacePhotoEmbeddedPlace(
  id: (json['id'] as num).toInt(),
  name: json['name'] as String,
  category: json['category'] as String,
  lat: (json['lat'] as num).toDouble(),
  lng: (json['lng'] as num).toDouble(),
);

Map<String, dynamic> _$PlacePhotoEmbeddedPlaceToJson(
  PlacePhotoEmbeddedPlace instance,
) => <String, dynamic>{
  'id': instance.id,
  'name': instance.name,
  'category': instance.category,
  'lat': instance.lat,
  'lng': instance.lng,
};
