import 'package:syrianzone/feature/mishwar/data/mishwar_map_point.dart';

class MapCluster {
  final double lat;
  final double lng;
  final List<MishwarMapPoint> points;

  MapCluster({
    required this.lat,
    required this.lng,
    required this.points,
  });

  bool get isSingle => points.length == 1;
}
