// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'hotel_response.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

HotelsResponse _$HotelsResponseFromJson(Map<String, dynamic> json) =>
    HotelsResponse(
      currentPage: (json['current_page'] as num).toInt(),
      data: (json['data'] as List<dynamic>)
          .map((e) => HotelResponse.fromJson(e as Map<String, dynamic>))
          .toList(),
      from: (json['from'] as num?)?.toInt(),
      lastPage: (json['last_page'] as num).toInt(),
      perPage: (json['per_page'] as num?)?.toInt(),
      to: (json['to'] as num?)?.toInt(),
      total: (json['total'] as num).toInt(),
    );

Map<String, dynamic> _$HotelsResponseToJson(HotelsResponse instance) =>
    <String, dynamic>{
      'current_page': instance.currentPage,
      'data': instance.data,
      'from': instance.from,
      'last_page': instance.lastPage,
      'per_page': instance.perPage,
      'to': instance.to,
      'total': instance.total,
    };

HotelResponse _$HotelResponseFromJson(Map<String, dynamic> json) =>
    HotelResponse(
      id: (json['id'] as num).toInt(),
      name: json['name'] as String,
      nameAr: json['name_ar'] as String?,
      city: json['city'] as String?,
      cityAr: json['city_ar'] as String?,
      slug: json['slug'] as String?,
      lat: (json['lat'] as num?)?.toDouble(),
      lng: (json['lng'] as num?)?.toDouble(),
      starRating: (json['star_rating'] as num?)?.toInt() ?? 0,
      nowShowRate: json['now_show_rate'],
      currency: json['currency'] as String?,
      thumbUrl: json['thumb_url'] as String?,
      sourceUrl: json['source_url'] as String?,
    );

Map<String, dynamic> _$HotelResponseToJson(HotelResponse instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'name_ar': instance.nameAr,
      'city': instance.city,
      'city_ar': instance.cityAr,
      'slug': instance.slug,
      'lat': instance.lat,
      'lng': instance.lng,
      'star_rating': instance.starRating,
      'now_show_rate': instance.nowShowRate,
      'currency': instance.currency,
      'thumb_url': instance.thumbUrl,
      'source_url': instance.sourceUrl,
    };
