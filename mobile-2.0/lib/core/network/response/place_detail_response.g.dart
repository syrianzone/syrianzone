// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'place_detail_response.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PlaceDetailResponse _$PlaceDetailResponseFromJson(Map<String, dynamic> json) =>
    PlaceDetailResponse(
      id: (json['id'] as num).toInt(),
      name: json['name'] as String,
      category: json['category'] as String,
      description: json['description'] as String?,
      lat: (json['lat'] as num).toDouble(),
      lng: (json['lng'] as num).toDouble(),
      thumbUrl: json['thumb_url'] as String?,
      savesCount: (json['saves_count'] as num?)?.toInt() ?? 0,
      status: json['status'] as String?,
      user: json['user'] == null
          ? null
          : PlaceAuthor.fromJson(json['user'] as Map<String, dynamic>),
      photos:
          (json['photos'] as List<dynamic>?)
              ?.map((e) => PlacePhotoItem.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      savedByMe: json['saved_by_me'] as bool?,
      createdAt: json['created_at'] as String?,
    );

Map<String, dynamic> _$PlaceDetailResponseToJson(
  PlaceDetailResponse instance,
) => <String, dynamic>{
  'id': instance.id,
  'name': instance.name,
  'category': instance.category,
  'description': instance.description,
  'lat': instance.lat,
  'lng': instance.lng,
  'thumb_url': instance.thumbUrl,
  'saves_count': instance.savesCount,
  'status': instance.status,
  'user': instance.user,
  'photos': instance.photos,
  'saved_by_me': instance.savedByMe,
  'created_at': instance.createdAt,
};

PlaceAuthor _$PlaceAuthorFromJson(Map<String, dynamic> json) => PlaceAuthor(
  id: (json['id'] as num).toInt(),
  name: json['name'] as String,
  avatarUrl: json['avatar_url'] as String?,
  level: (json['level'] as num?)?.toInt(),
  points: (json['points'] as num?)?.toInt(),
);

Map<String, dynamic> _$PlaceAuthorToJson(PlaceAuthor instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'avatar_url': instance.avatarUrl,
      'level': instance.level,
      'points': instance.points,
    };

PlacePhotoItem _$PlacePhotoItemFromJson(Map<String, dynamic> json) =>
    PlacePhotoItem(
      id: (json['id'] as num).toInt(),
      thumbUrl: json['thumb_url'] as String?,
      displayUrl: json['display_url'] as String,
      sort: (json['sort'] as num?)?.toInt() ?? 0,
    );

Map<String, dynamic> _$PlacePhotoItemToJson(PlacePhotoItem instance) =>
    <String, dynamic>{
      'id': instance.id,
      'thumb_url': instance.thumbUrl,
      'display_url': instance.displayUrl,
      'sort': instance.sort,
    };
