import 'package:flutter_test/flutter_test.dart';
import 'package:syrianzone/core/network/response/map_data_response.dart';

void main() {
  group('MapDataResponse Geometry & Parsing Regression Tests', () {
    test('Parses MultiLineString geometry correctly without throwing cast exception', () {
      final multiLineStringPayload = {
        'routes': {
          'type': 'FeatureCollection',
          'features': [
            {
              'type': 'Feature',
              'geometry': {
                'type': 'MultiLineString',
                'coordinates': [
                  [
                    [36.2, 33.5],
                    [36.3, 33.6],
                  ],
                  [
                    [36.4, 33.7],
                    [36.5, 33.8],
                  ],
                ],
              },
              'properties': {
                'id': 'route-multi-1',
                'nameAr': 'خط متعدد المقاطع',
                'colorIndex': 2,
                'priceNew': 500,
              },
            },
          ],
        },
        'stops': {
          'type': 'FeatureCollection',
          'features': [
            {
              'type': 'Feature',
              'geometry': {
                'type': 'Point',
                'coordinates': [36.25, 33.55],
              },
              'properties': {
                'id': 'stop-1',
                'nameAr': 'موقف 1',
                'routeIds': ['route-multi-1'],
              },
            },
          ],
        },
      };

      final response = MapDataResponse.fromJson(multiLineStringPayload);

      expect(response.routes.features.length, 1);
      final feature = response.routes.features.first;
      expect(feature.geometry.type, 'MultiLineString');
      expect(feature.geometry.segments.length, 2);
      expect(
        feature.geometry.segments[0].map((c) => [c.longitude, c.latitude]).toList(),
        [
          [36.2, 33.5],
          [36.3, 33.6],
        ],
      );
      expect(
        feature.geometry.segments[1].map((c) => [c.longitude, c.latitude]).toList(),
        [
          [36.4, 33.7],
          [36.5, 33.8],
        ],
      );
    });

    test('Parses LineString geometry and single segment correctly', () {
      final lineStringPayload = {
        'routes': {
          'type': 'FeatureCollection',
          'features': [
            {
              'type': 'Feature',
              'geometry': {
                'type': 'LineString',
                'coordinates': [
                  [36.2, 33.5],
                  [36.3, 33.6],
                ],
              },
              'properties': {
                'id': 'route-line-1',
                'nameAr': 'خط مستقيم',
                'colorIndex': 1,
              },
            },
          ],
        },
        'stops': {
          'type': 'FeatureCollection',
          'features': [],
        },
      };

      final response = MapDataResponse.fromJson(lineStringPayload);
      final feature = response.routes.features.first;

      expect(feature.geometry.type, 'LineString');
      expect(feature.geometry.segments.length, 1);
      expect(
        feature.geometry.segments.first.map((c) => [c.longitude, c.latitude]).toList(),
        [
          [36.2, 33.5],
          [36.3, 33.6],
        ],
      );
    });
  });
}
