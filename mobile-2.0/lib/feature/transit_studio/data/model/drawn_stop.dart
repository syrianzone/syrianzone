import 'package:flutter_osm_plugin/flutter_osm_plugin.dart';

class DrawnStop {
  final int id;
  final GeoPoint position;
  final int number;

  const DrawnStop({
    required this.id,
    required this.position,
    required this.number,
  });
}