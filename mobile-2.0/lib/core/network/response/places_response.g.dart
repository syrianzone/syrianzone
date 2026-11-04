// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'places_response.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PlacesResponse _$PlacesResponseFromJson(Map<String, dynamic> json) =>
    PlacesResponse(
      currentPage: (json['current_page'] as num).toInt(),
      data: (json['data'] as List<dynamic>)
          .map((e) => PlaceResponse.fromJson(e as Map<String, dynamic>))
          .toList(),
      from: (json['from'] as num?)?.toInt(),
      lastPage: (json['last_page'] as num).toInt(),
      perPage: (json['per_page'] as num).toInt(),
      to: (json['to'] as num?)?.toInt(),
      total: (json['total'] as num).toInt(),
    );

Map<String, dynamic> _$PlacesResponseToJson(PlacesResponse instance) =>
    <String, dynamic>{
      'current_page': instance.currentPage,
      'data': instance.data,
      'from': instance.from,
      'last_page': instance.lastPage,
      'per_page': instance.perPage,
      'to': instance.to,
      'total': instance.total,
    };

PlaceResponse _$PlaceResponseFromJson(Map<String, dynamic> json) =>
    PlaceResponse(
      id: (json['id'] as num).toInt(),
      name: json['name'] as String,
      category: json['category'] as String,
      description: json['description'] as String?,
      lat: (json['lat'] as num).toDouble(),
      lng: (json['lng'] as num).toDouble(),
      thumbUrl: json['thumb_url'] as String?,
      savesCount: (json['saves_count'] as num?)?.toInt() ?? 0,
    );

Map<String, dynamic> _$PlaceResponseToJson(PlaceResponse instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'category': instance.category,
      'description': instance.description,
      'lat': instance.lat,
      'lng': instance.lng,
      'thumb_url': instance.thumbUrl,
      'saves_count': instance.savesCount,
    };
