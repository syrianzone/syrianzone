import 'package:flutter_osm_plugin/flutter_osm_plugin.dart';

abstract class MapConstants {
  // Center of Syria (near Homs / Damascus)
  static const double defaultLat = 34.8021;
  static const double defaultLon = 38.9968;

  static const String cartoDarkTileUrl =
      'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png?key=cb1_4ory_1_2bda41a1b635c4e066436c8f';

  static CustomTile get cartoDarkTileLayer => CustomTile(
        urlsServers: [
          TileURLs(url: cartoDarkTileUrl),
        ],
        tileExtension: 'png',
        sourceName: 'Carto Dark',
      );
}
