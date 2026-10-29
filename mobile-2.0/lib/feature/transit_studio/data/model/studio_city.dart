import 'package:flutter_osm_plugin/flutter_osm_plugin.dart';

//TODO DELETE 
class StudioCity {
  final String id;
  final String nameAr;
  final String nameEn;
  final GeoPoint center;
  final double zoom;
  final int routeCount;

  const StudioCity({
    required this.id,
    required this.nameAr,
    required this.nameEn,
    required this.center,
    required this.zoom,
    this.routeCount = 0,
  });
}
