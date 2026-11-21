import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

abstract class MapConstants {
  // Center of Syria (near Homs / Damascus)
  static const double defaultLat = 34.8021;
  static const double defaultLon = 38.9968;
  static const LatLng defaultCenter = LatLng(defaultLat, defaultLon);

  // Global Zoom Limits
  static const double minZoom = 3.0;
  static const double mishwarMinZoom = 5.0;
  static const double maxZoom = 19.0;

  // Initial Zooms
  static const double mishwarInitialZoom = 6.2;
  static const double transitInitialZoom = 15.0;
  static const double studioInitialZoom = 14.0;
  static const double detailZoom = 15.0;
  static const double userLocationZoom = 14.0;

  // Clustering Constants (matching website PlacesMap / supercluster)
  static const double clusterMaxZoom = 10.0;
  static const double clusterStepZoom = 1.2;

  // Tile Configuration
  static const String cartoDarkTileUrl =
      'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png?key=cb1_4ory_1_2bda41a1b635c4e066436c8f';

  static TileLayer get cartoDarkTileLayer => TileLayer(
        urlTemplate: cartoDarkTileUrl,
        userAgentPackageName: 'syrian.zone',
        maxZoom: maxZoom,
        tileUpdateTransformer:
            TileUpdateTransformers.throttle(const Duration(milliseconds: 100)),
      );
}
