import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:syrianzone/core/data/model/lng_lat.dart';
import 'package:syrianzone/core/network/request/new_transit_route_request_body.dart';
import 'package:syrianzone/core/routing/app_router.dart';
import 'package:syrianzone/core/widget/splash.dart';
import 'package:syrianzone/main.dart';

void main() {
  testWidgets('App startup smoke test starts at splash screen', (
    WidgetTester tester,
  ) async {
    final appRouter = AppRouter();
    await tester.pumpWidget(MyApp(appRouter: appRouter));

    expect(find.byType(ZoneSplash), findsOneWidget);

    // Allow splash transition timer to finish cleanly
    await tester.pump(const Duration(seconds: 3));
  });

  group('Studio Submission Payload Regression Tests', () {
    test('Builds valid GeoJSON FeatureCollection request body for server contract', () {
      final routePoints = <LngLat>[
        LngLat(longitude: 36.29, latitude: 33.51),
        LngLat(longitude: 36.30, latitude: 33.52),
      ];

      final stopPoints = <LngLat>[
        LngLat(longitude: 36.295, latitude: 33.515),
      ];

      final routeFeature = NewTransitRouteFeature(
        type: 'Feature',
        properties: NewTransitRouteProperties(type: 'route'),
        geometry: NewTransitRouteGeometry.lineString(routePoints),
      );

      final stopFeature = NewTransitRouteFeature(
        type: 'Feature',
        properties: NewTransitRouteProperties(
          type: 'stop',
          nameAr: 'موقف الحجاز',
        ),
        geometry: NewTransitRouteGeometry.point(stopPoints.first),
      );

      final requestBody = NewTransitRouteRequestBody(
        cityId: 'damascus',
        nameAr: 'خط المزة - برامكة',
        nameEn: 'Mazzeh - Baramkeh',
        price: 1500,
        colorIndex: 3,
        notes: 'طريق مسار الذهاب',
        geojson: NewTransitRouteGeoJson(
          type: 'FeatureCollection',
          features: [routeFeature, stopFeature],
        ),
      );

      final json = jsonDecode(jsonEncode(requestBody)) as Map<String, dynamic>;

      // Top-level server contract assertions
      expect(json['city_id'], 'damascus');
      expect(json['name_ar'], 'خط المزة - برامكة');
      expect(json['name_en'], 'Mazzeh - Baramkeh');
      expect(json['price'], 1500);
      expect(json['color_index'], 3);
      expect(json['notes'], 'طريق مسار الذهاب');

      // GeoJSON payload assertions
      final geojson = json['geojson'] as Map<String, dynamic>;
      expect(geojson['type'], 'FeatureCollection');

      final features = geojson['features'] as List<dynamic>;
      expect(features.length, 2);

      // Route feature
      final routeJson = features[0] as Map<String, dynamic>;
      expect(routeJson['type'], 'Feature');
      expect(routeJson['properties']['type'], 'route');
      expect(routeJson['geometry']['type'], 'LineString');
      expect(routeJson['geometry']['coordinates'], [
        [36.29, 33.51],
        [36.30, 33.52],
      ]);

      // Stop feature
      final stopJson = features[1] as Map<String, dynamic>;
      expect(stopJson['type'], 'Feature');
      expect(stopJson['properties']['type'], 'stop');
      expect(stopJson['properties']['nameAr'], 'موقف الحجاز');
      expect(stopJson['geometry']['type'], 'Point');
      expect(stopJson['geometry']['coordinates'], [36.295, 33.515]);
    });
  });
}
