import 'package:json_annotation/json_annotation.dart';

part 'hotel_response.g.dart';

@JsonSerializable()
class HotelsResponse {
  @JsonKey(name: 'current_page')
  final int currentPage;
  final List<HotelResponse> data;
  final int? from;
  @JsonKey(name: 'last_page')
  final int lastPage;
  @JsonKey(name: 'per_page')
  final int? perPage;
  final int? to;
  final int total;

  HotelsResponse({
    required this.currentPage,
    required this.data,
    this.from,
    required this.lastPage,
    this.perPage,
    this.to,
    required this.total,
  });

  factory HotelsResponse.fromJson(Map<String, dynamic> json) =>
      _$HotelsResponseFromJson(json);
}

@JsonSerializable()
class HotelResponse {
  final int id;
  final String name;
  @JsonKey(name: 'name_ar')
  final String? nameAr;
  final String? city;
  @JsonKey(name: 'city_ar')
  final String? cityAr;
  final String? slug;
  final double? lat;
  final double? lng;
  @JsonKey(name: 'star_rating')
  final int starRating;
  @JsonKey(name: 'now_show_rate')
  final dynamic nowShowRate;
  final String? currency;
  @JsonKey(name: 'thumb_url')
  final String? thumbUrl;
  @JsonKey(name: 'source_url')
  final String? sourceUrl;

  HotelResponse({
    required this.id,
    required this.name,
    this.nameAr,
    this.city,
    this.cityAr,
    this.slug,
    this.lat,
    this.lng,
    this.starRating = 0,
    this.nowShowRate,
    this.currency,
    this.thumbUrl,
    this.sourceUrl,
  });

  factory HotelResponse.fromJson(Map<String, dynamic> json) =>
      _$HotelResponseFromJson(json);

  String get displayName => (nameAr != null && nameAr!.isNotEmpty) ? nameAr! : name;
}
