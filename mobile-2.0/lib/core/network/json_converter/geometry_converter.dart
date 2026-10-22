import 'package:flutter_osm_plugin/flutter_osm_plugin.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:syrianzone/core/data/model/lng_lat.dart';
import 'package:syrianzone/core/network/json_converter/lng_lat_json_converter.dart';
import 'package:syrianzone/core/network/request/new_transit_route_request_body.dart';

class GeometryCoordinatesConverter implements JsonConverter<Object, Object?> {
  const GeometryCoordinatesConverter();

  @override
  Object fromJson(Object? json) {
    if (json is List) {
      if (json.isNotEmpty && json.first is List) {
        return const LngLatListConverter().fromJson(json);
      }
      return const LngLatConverter().fromJson(json);
    }
    return json ?? const [];
  }

  @override
  Object? toJson(Object object) {
    if (object is List<LngLat>) {
      return const LngLatListConverter().toJson(object);
    } else if (object is LngLat) {
      return const LngLatConverter().toJson(object);
    } else if (object is GeoPoint) {
      return const LngLatConverter().toJson(object.toLngLat());
    } else if (object is List) {
      return object;
    }
    return object;
  }
}
