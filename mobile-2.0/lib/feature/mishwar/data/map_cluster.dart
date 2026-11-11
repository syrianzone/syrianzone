import 'package:syrianzone/feature/mishwar/data/mishwar_map_point.dart';

class MapCluster {
  double lat;
  double lng;
  final List<MishwarMapPoint> points;

  MapCluster({
    required this.lat,
    required this.lng,
    required this.points,
  });

  bool get isSingle => points.length == 1;

  void addPoint(MishwarMapPoint p) {
    points.add(p);
    recomputeCentroid();
  }

  void recomputeCentroid() {
    if (points.isEmpty) return;
    double sumLat = 0;
    double sumLng = 0;
    for (final pt in points) {
      sumLat += pt.lat;
      sumLng += pt.lng;
    }
    lat = sumLat / points.length;
    lng = sumLng / points.length;
  }
}
