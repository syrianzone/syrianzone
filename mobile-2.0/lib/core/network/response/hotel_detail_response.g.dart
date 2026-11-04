// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'hotel_detail_response.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

HotelDetailResponse _$HotelDetailResponseFromJson(Map<String, dynamic> json) =>
    HotelDetailResponse(
      id: (json['id'] as num).toInt(),
      name: json['name'] as String,
      nameAr: json['name_ar'] as String?,
      city: json['city'] as String?,
      cityAr: json['city_ar'] as String?,
      citySlug: json['city_slug'] as String?,
      slug: json['slug'] as String?,
      lat: (json['lat'] as num?)?.toDouble(),
      lng: (json['lng'] as num?)?.toDouble(),
      starRating: (json['star_rating'] as num?)?.toInt() ?? 0,
      rating: json['rating'],
      reviewCount: (json['review_count'] as num?)?.toInt(),
      nowShowRate: json['now_show_rate'],
      currency: json['currency'] as String?,
      address: json['address'] as String?,
      addressAr: json['address_ar'] as String?,
      phone: json['phone'] as String?,
      email: json['email'] as String?,
      description: json['description'] as String?,
      descriptionAr: json['description_ar'] as String?,
      images:
          (json['images'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const [],
      hasRestaurant: json['has_restaurant'] as bool?,
      hasSwimmingPool: json['has_swimming_pool'] as bool?,
      hasSpa: json['has_spa'] as bool?,
      hasFitnessCenter: json['has_fitness_center'] as bool?,
      hasParking: json['has_parking'] as bool?,
      hasAirportShuttle: json['has_airport_shuttle'] as bool?,
      hasBar: json['has_bar'] as bool?,
      hasRoomService: json['has_room_service'] as bool?,
      sourceUrl: json['source_url'] as String?,
    );

Map<String, dynamic> _$HotelDetailResponseToJson(
  HotelDetailResponse instance,
) => <String, dynamic>{
  'id': instance.id,
  'name': instance.name,
  'name_ar': instance.nameAr,
  'city': instance.city,
  'city_ar': instance.cityAr,
  'city_slug': instance.citySlug,
  'slug': instance.slug,
  'lat': instance.lat,
  'lng': instance.lng,
  'star_rating': instance.starRating,
  'rating': instance.rating,
  'review_count': instance.reviewCount,
  'now_show_rate': instance.nowShowRate,
  'currency': instance.currency,
  'address': instance.address,
  'address_ar': instance.addressAr,
  'phone': instance.phone,
  'email': instance.email,
  'description': instance.description,
  'description_ar': instance.descriptionAr,
  'images': instance.images,
  'has_restaurant': instance.hasRestaurant,
  'has_swimming_pool': instance.hasSwimmingPool,
  'has_spa': instance.hasSpa,
  'has_fitness_center': instance.hasFitnessCenter,
  'has_parking': instance.hasParking,
  'has_airport_shuttle': instance.hasAirportShuttle,
  'has_bar': instance.hasBar,
  'has_room_service': instance.hasRoomService,
  'source_url': instance.sourceUrl,
};
