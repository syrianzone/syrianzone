 // Tile layer matching TransitMapPane
  import 'package:flutter_osm_plugin/flutter_osm_plugin.dart';

final osmTile = CustomTile(
    urlsServers: List<TileURLs>.of([
      TileURLs(
        url:
            "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png?key=cb1_4ory_1_2bda41a1b635c4e066436c8f",
      ),
    ]),
    tileExtension: 'png',
    sourceName: 'Carto Streets',
  );