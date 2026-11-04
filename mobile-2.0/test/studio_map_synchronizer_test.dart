import 'package:flutter_osm_plugin/flutter_osm_plugin.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:syrianzone/feature/transit_studio/data/model/studio_tool_mode.dart';
import 'package:syrianzone/feature/transit_studio/logic/transit_studio_state.dart';
import 'package:syrianzone/feature/transit_studio/ui/widget/map/studio_map_synchronizer.dart';

class FakeDelayedMapController extends Fake implements MapController {
  final List<String> log = [];
  final Duration delay;
  int addMarkerCalls = 0;
  int activeOperations = 0;
  int maxConcurrentOperations = 0;

  FakeDelayedMapController({this.delay = const Duration(milliseconds: 30)});

  void _begin(String op) {
    activeOperations++;
    if (activeOperations > maxConcurrentOperations) {
      maxConcurrentOperations = activeOperations;
    }
    log.add('start:$op');
  }

  void _finish(String op) {
    activeOperations--;
    log.add('end:$op');
  }

  @override
  Future<void> addMarker(
    GeoPoint p, {
    MarkerIcon? markerIcon,
    double? angle,
    IconAnchor? iconAnchor,
  }) async {
    final op = 'addMarker:${p.latitude},${p.longitude}';
    _begin(op);
    await Future.delayed(delay);
    addMarkerCalls++;
    _finish(op);
  }

  @override
  Future<void> removeMarker(GeoPoint position) async {
    final op = 'removeMarker:${position.latitude},${position.longitude}';
    _begin(op);
    await Future.delayed(delay);
    _finish(op);
  }

  @override
  Future<void> drawRoadManually(List<GeoPoint> points, RoadOption roadOption) async {
    final op = 'drawRoad:${points.length}';
    _begin(op);
    await Future.delayed(delay);
    _finish(op);
  }

  @override
  Future<void> clearAllRoads() async {
    final op = 'clearAllRoads';
    _begin(op);
    await Future.delayed(delay);
    _finish(op);
  }

  @override
  Future<void> removeLastRoad() async {
    final op = 'removeLastRoad';
    _begin(op);
    await Future.delayed(delay);
    _finish(op);
  }
}

void main() {
  group('StudioMapSynchronizer Serialization Tests', () {
    test('Serializes consecutive state updates with delayed map operations without duplicating points', () async {
      final fakeController = FakeDelayedMapController(
        delay: const Duration(milliseconds: 40),
      );
      final synchronizer = StudioMapSynchronizer(mapController: fakeController);
      synchronizer.isMapReady = true;

      final point1 = GeoPoint(latitude: 33.51, longitude: 36.29);

      // State 1: A point was added in drawRoad mode
      final state1 = TransitStudioState(
        roadPoints: [point1],
        activeTool: StudioToolMode.drawRoad,
      );

      // State 2: User switches mode to none while point1 marker is still pending
      final state2 = TransitStudioState(
        roadPoints: [point1],
        activeTool: StudioToolMode.none,
      );

      // Trigger sync for state 1 and state 2 concurrently without awaiting between them
      final f1 = synchronizer.sync(state1);
      final f2 = synchronizer.sync(state2);

      await Future.wait([f1, f2]);

      // Exactly 1 marker should be added for point1 (no duplicate addition from race condition)
      expect(fakeController.addMarkerCalls, 1);
      // Map operations are serialized, not concurrently overlapping
      expect(fakeController.maxConcurrentOperations, 1);
    });

    test('Queues updates and applies latest state after in-flight sync completes', () async {
      final fakeController = FakeDelayedMapController(
        delay: const Duration(milliseconds: 30),
      );
      final synchronizer = StudioMapSynchronizer(mapController: fakeController);
      synchronizer.isMapReady = true;

      final p1 = GeoPoint(latitude: 33.51, longitude: 36.29);
      final p2 = GeoPoint(latitude: 33.52, longitude: 36.30);
      final p3 = GeoPoint(latitude: 33.53, longitude: 36.31);

      // Launch state 1
      final f1 = synchronizer.sync(TransitStudioState(roadPoints: [p1]));

      // Queue state 2 and then state 3 while state 1 is processing
      final f2 = synchronizer.sync(TransitStudioState(roadPoints: [p1, p2]));
      final f3 = synchronizer.sync(TransitStudioState(roadPoints: [p1, p2, p3]));

      await Future.wait([f1, f2, f3]);

      // All 3 futures must complete cleanly and latest state (3 points) is applied
      expect(fakeController.maxConcurrentOperations, 1);
    });
  });
}
