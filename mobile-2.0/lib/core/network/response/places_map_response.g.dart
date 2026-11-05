// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'places_map_response.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PlacesMapResponse _$PlacesMapResponseFromJson(Map<String, dynamic> json) =>
    PlacesMapResponse(
      type: json['type'] as String,
      features: (json['features'] as List<dynamic>)
          .map((e) => PlaceMapFeature.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$PlacesMapResponseToJson(PlacesMapResponse instance) =>
    <String, dynamic>{'type': instance.type, 'features': instance.features};

PlaceMapFeature _$PlaceMapFeatureFromJson(Map<String, dynamic> json) =>
    PlaceMapFeature(
      type: json['type'] as String,
      geometry: PlaceMapGeometry.fromJson(
        json['geometry'] as Map<String, dynamic>,
      ),
      properties: PlaceMapProperties.fromJson(
        json['properties'] as Map<String, dynamic>,
      ),
    );

Map<String, dynamic> _$PlaceMapFeatureToJson(PlaceMapFeature instance) =>
    <String, dynamic>{
      'type': instance.type,
      'geometry': instance.geometry,
      'properties': instance.properties,
    };

PlaceMapGeometry _$PlaceMapGeometryFromJson(Map<String, dynamic> json) =>
    PlaceMapGeometry(
      type: json['type'] as String,
      coordinates: const LngLatConverter().fromJson(json['coordinates']),
    );

Map<String, dynamic> _$PlaceMapGeometryToJson(PlaceMapGeometry instance) =>
    <String, dynamic>{
      'type': instance.type,
      'coordinates': const LngLatConverter().toJson(instance.coordinates),
    };

PlaceMapProperties _$PlaceMapPropertiesFromJson(Map<String, dynamic> json) =>
    PlaceMapProperties(
      id: (json['id'] as num).toInt(),
      name: json['name'] as String,
      category: json['category'] as String?,
      thumbUrl: json['thumb_url'] as String?,
      userId: (json['user_id'] as num?)?.toInt(),
      type: json['type'] as String?,
    );

Map<String, dynamic> _$PlaceMapPropertiesToJson(PlaceMapProperties instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'category': instance.category,
      'thumb_url': instance.thumbUrl,
      'user_id': instance.userId,
      'type': instance.type,
    };
