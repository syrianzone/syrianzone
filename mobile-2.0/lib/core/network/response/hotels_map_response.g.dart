// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'hotels_map_response.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

HotelsMapResponse _$HotelsMapResponseFromJson(Map<String, dynamic> json) =>
    HotelsMapResponse(
      type: json['type'] as String,
      features: (json['features'] as List<dynamic>)
          .map((e) => HotelMapFeature.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$HotelsMapResponseToJson(HotelsMapResponse instance) =>
    <String, dynamic>{'type': instance.type, 'features': instance.features};

HotelMapFeature _$HotelMapFeatureFromJson(Map<String, dynamic> json) =>
    HotelMapFeature(
      type: json['type'] as String,
      geometry: HotelMapGeometry.fromJson(
        json['geometry'] as Map<String, dynamic>,
      ),
      properties: HotelMapProperties.fromJson(
        json['properties'] as Map<String, dynamic>,
      ),
    );

Map<String, dynamic> _$HotelMapFeatureToJson(HotelMapFeature instance) =>
    <String, dynamic>{
      'type': instance.type,
      'geometry': instance.geometry,
      'properties': instance.properties,
    };

HotelMapGeometry _$HotelMapGeometryFromJson(Map<String, dynamic> json) =>
    HotelMapGeometry(
      type: json['type'] as String,
      coordinates: const LngLatConverter().fromJson(json['coordinates']),
    );

Map<String, dynamic> _$HotelMapGeometryToJson(HotelMapGeometry instance) =>
    <String, dynamic>{
      'type': instance.type,
      'coordinates': const LngLatConverter().toJson(instance.coordinates),
    };

HotelMapProperties _$HotelMapPropertiesFromJson(Map<String, dynamic> json) =>
    HotelMapProperties(
      id: (json['id'] as num).toInt(),
      name: json['name'] as String,
      nameAr: json['name_ar'] as String?,
      type: json['type'] as String?,
      starRating: (json['star_rating'] as num?)?.toInt(),
      nowShowRate: json['now_show_rate'],
      city: json['city'] as String?,
      cityAr: json['city_ar'] as String?,
      thumbUrl: json['thumb_url'] as String?,
      slug: json['slug'] as String?,
    );

Map<String, dynamic> _$HotelMapPropertiesToJson(HotelMapProperties instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'name_ar': instance.nameAr,
      'type': instance.type,
      'star_rating': instance.starRating,
      'now_show_rate': instance.nowShowRate,
      'city': instance.city,
      'city_ar': instance.cityAr,
      'thumb_url': instance.thumbUrl,
      'slug': instance.slug,
    };
