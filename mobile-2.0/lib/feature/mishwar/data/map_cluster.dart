import 'package:syrianzone/feature/mishwar/data/mishwar_map_point.dart';

class MapCluster {
  double lat;
  double lng;
  final List<MishwarMapPoint> points;
  double _sumLat;
  double _sumLng;

  MapCluster({
    required this.lat,
    required this.lng,
    required this.points,
  })  : _sumLat = lat,
        _sumLng = lng {
    if (points.length > 1) {
      double sumLat = 0;
      double sumLng = 0;
      for (final pt in points) {
        sumLat += pt.lat;
        sumLng += pt.lng;
      }
      _sumLat = sumLat;
      _sumLng = sumLng;
      lat = _sumLat / points.length;
      lng = _sumLng / points.length;
    }
  }

  bool get isSingle => points.length == 1;

  void addPoint(MishwarMapPoint p) {
    points.add(p);
    _sumLat += p.lat;
    _sumLng += p.lng;
    lat = _sumLat / points.length;
    lng = _sumLng / points.length;
  }

  void recomputeCentroid() {
    if (points.isEmpty) return;
    double sumLat = 0;
    double sumLng = 0;
    for (final pt in points) {
      sumLat += pt.lat;
      sumLng += pt.lng;
    }
    _sumLat = sumLat;
    _sumLng = sumLng;
    lat = _sumLat / points.length;
    lng = _sumLng / points.length;
  }
}
