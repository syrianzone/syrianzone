import 'package:json_annotation/json_annotation.dart';

part 'hotel_detail_response.g.dart';

@JsonSerializable()
class HotelDetailResponse {
  final int id;
  final String name;
  @JsonKey(name: 'name_ar')
  final String? nameAr;
  final String? city;
  @JsonKey(name: 'city_ar')
  final String? cityAr;
  @JsonKey(name: 'city_slug')
  final String? citySlug;
  final String? slug;
  final double? lat;
  final double? lng;
  @JsonKey(name: 'star_rating')
  final int starRating;
  final dynamic rating;
  @JsonKey(name: 'review_count')
  final int? reviewCount;
  @JsonKey(name: 'now_show_rate')
  final dynamic nowShowRate;
  final String? currency;
  final String? address;
  @JsonKey(name: 'address_ar')
  final String? addressAr;
  final String? phone;
  final String? email;
  final String? description;
  @JsonKey(name: 'description_ar')
  final String? descriptionAr;
  final List<String> images;
  @JsonKey(name: 'has_restaurant')
  final bool? hasRestaurant;
  @JsonKey(name: 'has_swimming_pool')
  final bool? hasSwimmingPool;
  @JsonKey(name: 'has_spa')
  final bool? hasSpa;
  @JsonKey(name: 'has_fitness_center')
  final bool? hasFitnessCenter;
  @JsonKey(name: 'has_parking')
  final bool? hasParking;
  @JsonKey(name: 'has_airport_shuttle')
  final bool? hasAirportShuttle;
  @JsonKey(name: 'has_bar')
  final bool? hasBar;
  @JsonKey(name: 'has_room_service')
  final bool? hasRoomService;
  @JsonKey(name: 'source_url')
  final String? sourceUrl;

  HotelDetailResponse({
    required this.id,
    required this.name,
    this.nameAr,
    this.city,
    this.cityAr,
    this.citySlug,
    this.slug,
    this.lat,
    this.lng,
    this.starRating = 0,
    this.rating,
    this.reviewCount,
    this.nowShowRate,
    this.currency,
    this.address,
    this.addressAr,
    this.phone,
    this.email,
    this.description,
    this.descriptionAr,
    this.images = const [],
    this.hasRestaurant,
    this.hasSwimmingPool,
    this.hasSpa,
    this.hasFitnessCenter,
    this.hasParking,
    this.hasAirportShuttle,
    this.hasBar,
    this.hasRoomService,
    this.sourceUrl,
  });

  factory HotelDetailResponse.fromJson(Map<String, dynamic> json) =>
      _$HotelDetailResponseFromJson(json);

  String get displayName => (nameAr != null && nameAr!.isNotEmpty) ? nameAr! : name;
  String? get displayDescription => (descriptionAr != null && descriptionAr!.isNotEmpty) ? descriptionAr : description;
  String? get displayAddress => (addressAr != null && addressAr!.isNotEmpty) ? addressAr : address;
}
