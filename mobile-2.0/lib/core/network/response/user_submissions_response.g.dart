// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'user_submissions_response.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UserSubmissionsResponse _$UserSubmissionsResponseFromJson(
  Map<String, dynamic> json,
) => UserSubmissionsResponse(
  data: (json['data'] as List<dynamic>)
      .map((e) => RouteDraftItem.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$UserSubmissionsResponseToJson(
  UserSubmissionsResponse instance,
) => <String, dynamic>{'data': instance.data};

RouteDraftItem _$RouteDraftItemFromJson(Map<String, dynamic> json) =>
    RouteDraftItem(
      id: (json['id'] as num).toInt(),
      userId: (json['user_id'] as num?)?.toInt(),
      routeId: json['route_id'] as String?,
      cityId: json['city_id'] as String,
      nameAr: json['name_ar'] as String,
      nameEn: json['name_en'] as String?,
      price: (json['price'] as num?)?.toInt(),
      colorIndex: (json['color_index'] as num?)?.toInt(),
      notes: json['notes'] as String?,
      status: json['status'] as String,
      rejectionReason: json['rejection_reason'] as String?,
      geojson: json['geojson'] == null
          ? null
          : TransitRouteGeoJson.fromJson(
              json['geojson'] as Map<String, dynamic>,
            ),
      city: json['city'] == null
          ? null
          : DraftCityResponse.fromJson(json['city'] as Map<String, dynamic>),
      createdAt: json['created_at'] as String?,
      updatedAt: json['updated_at'] as String?,
    );

Map<String, dynamic> _$RouteDraftItemToJson(RouteDraftItem instance) =>
    <String, dynamic>{
      'id': instance.id,
      'user_id': instance.userId,
      'route_id': instance.routeId,
      'city_id': instance.cityId,
      'name_ar': instance.nameAr,
      'name_en': instance.nameEn,
      'price': instance.price,
      'color_index': instance.colorIndex,
      'notes': instance.notes,
      'status': instance.status,
      'rejection_reason': instance.rejectionReason,
      'geojson': instance.geojson,
      'city': instance.city,
      'created_at': instance.createdAt,
      'updated_at': instance.updatedAt,
    };

DraftCityResponse _$DraftCityResponseFromJson(Map<String, dynamic> json) =>
    DraftCityResponse(
      id: json['id'] as String,
      nameAr: json['name_ar'] as String,
      nameEn: json['name_en'] as String?,
    );

Map<String, dynamic> _$DraftCityResponseToJson(DraftCityResponse instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name_ar': instance.nameAr,
      'name_en': instance.nameEn,
    };
