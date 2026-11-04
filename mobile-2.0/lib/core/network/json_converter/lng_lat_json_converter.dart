import 'package:json_annotation/json_annotation.dart';
import 'package:syrianzone/core/data/model/lng_lat.dart';

double? _toDouble(dynamic val) {
  if (val is num) return val.toDouble();
  if (val is String) return double.tryParse(val);
  return null;
}

class LngLatConverter implements JsonConverter<LngLat, Object?> {
  const LngLatConverter();

  @override
  LngLat fromJson(Object? json) {
    if (json is List && json.length >= 2) {
      final lng = _toDouble(json[0]);
      final lat = _toDouble(json[1]);
      if (lng != null && lat != null) {
        return LngLat(longitude: lng, latitude: lat);
      }
    }
    throw ArgumentError('Cannot parse LngLat from: $json');
  }

  @override
  Object? toJson(LngLat object) {
    return [object.longitude, object.latitude];
  }
}

class LngLatListConverter implements JsonConverter<List<LngLat>, Object?> {
  const LngLatListConverter();

  @override
  List<LngLat> fromJson(Object? json) {
    if (json is List) {
      return json
          .map((item) => const LngLatConverter().fromJson(item))
          .toList();
    }
    return const [];
  }

  @override
  Object? toJson(List<LngLat> object) {
    return object.map((item) => const LngLatConverter().toJson(item)).toList();
  }
}
