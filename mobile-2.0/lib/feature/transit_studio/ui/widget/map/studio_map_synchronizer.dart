import 'dart:async';
import 'dart:ui';
import 'package:flutter_osm_plugin/flutter_osm_plugin.dart';
import 'package:syrianzone/core/constants/route_palette.dart';
import 'package:syrianzone/core/data/model/lng_lat.dart';
import 'package:syrianzone/core/network/response/map_data_response.dart';
import 'package:syrianzone/core/util/color_util.dart';
import '../../../data/model/drawn_stop.dart';
import '../../../logic/transit_studio_state.dart';
import 'studio_markers.dart';

class StudioMapSynchronizer {
  final MapController mapController;
  bool isMapReady = false;

  final List<GeoPoint> _drawnRoadPoints = [];
  int? _drawnSelectedPointIndex;
  final List<DrawnStop> _drawnStops = [];
  Color? _drawnRoadColor;
  String? _drawnCityId;

  // City mapData tracking
  MapDataResponse? _drawnCityMapData;
  final List<GeoPoint> _drawnCityStops = [];
  bool _hasDrawnStudioRoad = false;

  bool _isSyncing = false;
  TransitStudioState? _pendingState;
  bool _pendingForce = false;
  final List<Completer<void>> _pendingCompleters = [];

  StudioMapSynchronizer({required this.mapController});

  Future<void> sync(TransitStudioState state, {bool force = false}) async {
    if (!isMapReady) return;

    if (_isSyncing) {
      _pendingState = state;
      _pendingForce = _pendingForce || force;
      final completer = Completer<void>();
      _pendingCompleters.add(completer);
      return completer.future;
    }

    _isSyncing = true;
    try {
      await _performSync(state, force: force);

      while (_pendingState != null) {
        final nextState = _pendingState!;
        final nextForce = _pendingForce;
        final completers = List<Completer<void>>.from(_pendingCompleters);

        _pendingState = null;
        _pendingForce = false;
        _pendingCompleters.clear();

        try {
          await _performSync(nextState, force: nextForce);
        } finally {
          for (final c in completers) {
            if (!c.isCompleted) {
              c.complete();
            }
          }
        }
      }
    } finally {
      _isSyncing = false;
    }
  }

  Future<void> _performSync(TransitStudioState state, {bool force = false}) async {
    if (!isMapReady) return;

    // 1. Sync city camera if changed
    final cityChanged = state.selectedCity?.id != _drawnCityId;
    if (force || cityChanged) {
      if (state.selectedCity != null) {
        try {
          await mapController.moveTo(
            state.selectedCity!.center.toGeoPoint(),
            animate: true,
          );
          await mapController.setZoom(zoomLevel: state.selectedCity!.zoom);
        } catch (_) {}
      }
      _drawnCityId = state.selectedCity?.id;
    }

    // 2. Sync city map data (routes & stops)
    final cityDataChanged = state.cityMapData != _drawnCityMapData;
    if (force || cityChanged || cityDataChanged) {
      await _syncCityMapData(state, force: force || cityChanged);
    }

    // 3. Incremental sync for road points and moving handle
    await _syncRoadPointsAndMode(state, force: force);

    // 4. Incremental sync for road color (only polyline, no marker redraws)
    await _syncRoadColor(state);

    // 5. Incremental sync for studio stops
    await _syncStops(state, force: force);
  }

  Future<void> _syncCityMapData(
    TransitStudioState state, {
    bool force = false,
  }) async {
    if (!isMapReady) return;

    // Remove previously drawn city stops
    if (_drawnCityStops.isNotEmpty) {
      try {
        await Future.wait(_drawnCityStops.map((p) async {
          try {
            await mapController.removeMarker(p);
          } catch (_) {}
        }));
      } catch (_) {}
      _drawnCityStops.clear();
    }

    // Clear all roads to reset city routes + any previous studio road
    try {
      await mapController.clearAllRoads();
    } catch (_) {}
    _hasDrawnStudioRoad = false;

    // Draw city routes and city stops from MapDataResponse
    if (state.cityMapData != null) {
      final roadDrawFutures = <Future<void>>[];
      for (final routeFeature in state.cityMapData!.routes.features) {
        if (routeFeature.geometry.type != 'LineString' &&
            routeFeature.geometry.type != 'MultiLineString') {
          continue;
        }
        final roadColor = ColorUtil.hexToColor(
          RoutePalette.colorForIndexOrDefault(routeFeature.properties.colorIndex),
        );

        for (final segment in routeFeature.geometry.segments) {
          final points = segment.map((c) => c.toGeoPoint()).toList();
          if (points.length < 2) continue;

          roadDrawFutures.add(
            mapController.drawRoadManually(
              points,
              RoadOption(
                roadColor: roadColor,
                roadWidth: 4,
                zoomInto: false,
              ),
            ),
          );
        }
      }

      try {
        await Future.wait(roadDrawFutures);
      } catch (_) {}

      // Draw city stops
      final stopAddFutures = <Future<void>>[];
      for (final stopFeature in state.cityMapData!.stops.features) {
        if (stopFeature.geometry.type != 'Point') continue;
        final coords = stopFeature.geometry.coordinates;
        if (coords.length < 2) continue;

        final point = GeoPoint(latitude: coords[1], longitude: coords[0]);
        _drawnCityStops.add(point);

        stopAddFutures.add(
          mapController.addMarker(
            point,
            markerIcon: MarkerIcon(
              iconWidget: buildCityStopMarker(),
            ),
          ),
        );
      }

      try {
        await Future.wait(stopAddFutures);
      } catch (_) {}
    }

    _drawnCityMapData = state.cityMapData;

    // Re-draw the user's studio road on top of the newly drawn city routes if present
    if (state.roadPoints.length >= 2) {
      try {
        await mapController.drawRoadManually(
          state.roadPoints,
          RoadOption(
            roadColor: state.currentColor,
            roadWidth: 6,
            zoomInto: false,
          ),
        );
        _hasDrawnStudioRoad = true;
      } catch (_) {}
    }
  }

  Future<void> _syncRoadPointsAndMode(
    TransitStudioState state, {
    bool force = false,
  }) async {
    // Force or initial sync
    if (force) {
      for (final p in _drawnRoadPoints) {
        try {
          await mapController.removeMarker(p);
        } catch (_) {}
      }
      _drawnRoadPoints.clear();
      _drawnSelectedPointIndex = null;

      for (int i = 0; i < state.roadPoints.length; i++) {
        final pt = state.roadPoints[i];
        final isSelected = state.selectedPointIndex == i;
        try {
          await mapController.addMarker(
            pt,
            markerIcon: MarkerIcon(
              iconWidget: buildStudioNodeMarker(isSelected, state.currentColor),
            ),
          );
        } catch (_) {}
        _drawnRoadPoints.add(pt);
      }
      _drawnSelectedPointIndex = state.selectedPointIndex;
      await _redrawRoadPolyline(state.roadPoints, state.currentColor);
      return;
    }

    // Case 1: Road cleared / reset
    if (state.roadPoints.isEmpty) {
      if (_drawnRoadPoints.isNotEmpty) {
        for (final p in _drawnRoadPoints) {
          try {
            await mapController.removeMarker(p);
          } catch (_) {}
        }
        _drawnRoadPoints.clear();
        _drawnSelectedPointIndex = null;
        if (_hasDrawnStudioRoad) {
          try {
            await mapController.removeLastRoad();
          } catch (_) {
            await _fullRedrawAllRoads(const [], state.currentColor);
          }
          _hasDrawnStudioRoad = false;
        }
      }
      return;
    }

    // Case 2: Length is identical
    if (state.roadPoints.length == _drawnRoadPoints.length) {
      int changedIndex = -1;
      int changedCount = 0;
      for (int i = 0; i < state.roadPoints.length; i++) {
        if (!_arePointsEqual(state.roadPoints[i], _drawnRoadPoints[i])) {
          changedIndex = i;
          changedCount++;
        }
      }

      // Points did not move at all (e.g. clicking finish, adding/deleting a stop, form text changes)
      if (changedCount == 0) {
        // Only update selection handle if move mode was toggled
        if (_drawnSelectedPointIndex != state.selectedPointIndex) {
          // Unselect previous handle
          if (_drawnSelectedPointIndex != null &&
              _drawnSelectedPointIndex! < _drawnRoadPoints.length) {
            final prevPt = _drawnRoadPoints[_drawnSelectedPointIndex!];
            try {
              await mapController.removeMarker(prevPt);
              await mapController.addMarker(
                prevPt,
                markerIcon: MarkerIcon(
                  iconWidget: buildStudioNodeMarker(false, state.currentColor),
                ),
              );
            } catch (_) {}
          }

          // Select new handle (show ✋ icon)
          if (state.selectedPointIndex != null &&
              state.selectedPointIndex! < _drawnRoadPoints.length) {
            final newSelectedPt = _drawnRoadPoints[state.selectedPointIndex!];
            try {
              await mapController.removeMarker(newSelectedPt);
              await mapController.addMarker(
                newSelectedPt,
                markerIcon: MarkerIcon(
                  iconWidget: buildStudioNodeMarker(true, state.currentColor),
                ),
              );
            } catch (_) {}
          }

          _drawnSelectedPointIndex = state.selectedPointIndex;
        }
        return; // Zero road blink
      }

      // Exactly 1 point moved
      if (changedCount == 1) {
        final oldPt = _drawnRoadPoints[changedIndex];
        final newPt = state.roadPoints[changedIndex];
        try {
          await mapController.removeMarker(oldPt);
        } catch (_) {}
        try {
          await mapController.addMarker(
            newPt,
            markerIcon: MarkerIcon(
              iconWidget: buildStudioNodeMarker(false, state.currentColor),
            ),
          );
        } catch (_) {}
        _drawnRoadPoints[changedIndex] = newPt;
        _drawnSelectedPointIndex = null;
        await _redrawRoadPolyline(state.roadPoints, state.currentColor);
        return;
      }
    }

    // Case 3: New point appended (add marker for the new point only, zero blink!)
    if (state.roadPoints.length == _drawnRoadPoints.length + 1 &&
        _isListPrefix(_drawnRoadPoints, state.roadPoints)) {
      final newPoint = state.roadPoints.last;
      try {
        await mapController.addMarker(
          newPoint,
          markerIcon: MarkerIcon(
            iconWidget: buildStudioNodeMarker(false, state.currentColor),
          ),
        );
      } catch (_) {}
      _drawnRoadPoints.add(newPoint);
      await _redrawRoadPolyline(state.roadPoints, state.currentColor);
      return;
    }

    // Case 4: Point removed (undo last point)
    if (state.roadPoints.length == _drawnRoadPoints.length - 1 &&
        _isListPrefix(state.roadPoints, _drawnRoadPoints)) {
      final removedPoint = _drawnRoadPoints.last;
      try {
        await mapController.removeMarker(removedPoint);
      } catch (_) {}
      _drawnRoadPoints.removeLast();
      if (_drawnSelectedPointIndex == _drawnRoadPoints.length) {
        _drawnSelectedPointIndex = null;
      }
      await _redrawRoadPolyline(state.roadPoints, state.currentColor);
      return;
    }

    // Fallback: full sync only if arbitrary external point modifications happened
    for (final p in _drawnRoadPoints) {
      try {
        await mapController.removeMarker(p);
      } catch (_) {}
    }
    _drawnRoadPoints.clear();
    for (int i = 0; i < state.roadPoints.length; i++) {
      final pt = state.roadPoints[i];
      final isSelected = state.selectedPointIndex == i;
      try {
        await mapController.addMarker(
          pt,
          markerIcon: MarkerIcon(
            iconWidget: buildStudioNodeMarker(isSelected, state.currentColor),
          ),
        );
      } catch (_) {}
      _drawnRoadPoints.add(pt);
    }
    _drawnSelectedPointIndex = state.selectedPointIndex;
    await _redrawRoadPolyline(state.roadPoints, state.currentColor);
  }

  Future<void> _syncRoadColor(TransitStudioState state) async {
    if (state.currentColor != _drawnRoadColor) {
      _drawnRoadColor = state.currentColor;
      // Redraw only the road polyline with the new color without touching markers
      await _redrawRoadPolyline(state.roadPoints, state.currentColor);
    }
  }

  Future<void> _redrawRoadPolyline(List<GeoPoint> points, Color color) async {
    if (!isMapReady) return;
    try {
      if (_hasDrawnStudioRoad) {
        try {
          await mapController.removeLastRoad();
          _hasDrawnStudioRoad = false;
        } catch (_) {
          await _fullRedrawAllRoads(points, color);
          return;
        }
      }

      if (points.length >= 2) {
        await mapController.drawRoadManually(
          points,
          RoadOption(
            roadColor: color,
            roadWidth: 6,
            zoomInto: false,
          ),
        );
        _hasDrawnStudioRoad = true;
      }
    } catch (_) {}
  }

  Future<void> _fullRedrawAllRoads(List<GeoPoint> points, Color color) async {
    try {
      await mapController.clearAllRoads();
      if (_drawnCityMapData != null) {
        final futures = <Future<void>>[];
        for (final routeFeature in _drawnCityMapData!.routes.features) {
          if (routeFeature.geometry.type != 'LineString' &&
              routeFeature.geometry.type != 'MultiLineString') {
            continue;
          }
          final roadColor = ColorUtil.hexToColor(
            RoutePalette.colorForIndexOrDefault(routeFeature.properties.colorIndex),
          );

          for (final segment in routeFeature.geometry.segments) {
            final pts = segment.map((c) => c.toGeoPoint()).toList();
            if (pts.length < 2) continue;

            futures.add(
              mapController.drawRoadManually(
                pts,
                RoadOption(
                  roadColor: roadColor,
                  roadWidth: 4,
                  zoomInto: false,
                ),
              ),
            );
          }
        }
        await Future.wait(futures);
      }

      if (points.length >= 2) {
        await mapController.drawRoadManually(
          points,
          RoadOption(
            roadColor: color,
            roadWidth: 6,
            zoomInto: false,
          ),
        );
        _hasDrawnStudioRoad = true;
      } else {
        _hasDrawnStudioRoad = false;
      }
    } catch (_) {}
  }

  Future<void> _syncStops(TransitStudioState state, {bool force = false}) async {
    if (force) {
      if (_drawnStops.isNotEmpty) {
        try {
          await Future.wait(_drawnStops.map((s) async {
            try {
              await mapController.removeMarker(s.position);
            } catch (_) {}
          }));
        } catch (_) {}
        _drawnStops.clear();
      }

      for (int i = 0; i < state.stops.length; i++) {
        final stop = state.stops[i];
        final number = i + 1;
        try {
          await mapController.addMarker(
            stop.position,
            markerIcon: MarkerIcon(
              iconWidget: buildStudioStopMarker(number),
            ),
          );
        } catch (_) {}
        _drawnStops.add(DrawnStop(
          id: stop.id,
          position: stop.position,
          number: number,
        ));
      }
      return;
    }

    // Case 1: Stops cleared / reset
    if (state.stops.isEmpty) {
      if (_drawnStops.isNotEmpty) {
        try {
          await Future.wait(_drawnStops.map((s) async {
            try {
              await mapController.removeMarker(s.position);
            } catch (_) {}
          }));
        } catch (_) {}
        _drawnStops.clear();
      }
      return;
    }

    // Case 2: New stop appended at end (add only the new stop marker, previous stops 100% untouched!)
    if (state.stops.length == _drawnStops.length + 1) {
      bool prefixMatches = true;
      for (int i = 0; i < _drawnStops.length; i++) {
        if (_drawnStops[i].id != state.stops[i].id ||
            !_arePointsEqual(_drawnStops[i].position, state.stops[i].position) ||
            _drawnStops[i].number != i + 1) {
          prefixMatches = false;
          break;
        }
      }

      if (prefixMatches) {
        final newStop = state.stops.last;
        final newNumber = state.stops.length;
        try {
          await mapController.addMarker(
            newStop.position,
            markerIcon: MarkerIcon(
              iconWidget: buildStudioStopMarker(newNumber),
            ),
          );
        } catch (_) {}
        _drawnStops.add(DrawnStop(
          id: newStop.id,
          position: newStop.position,
          number: newNumber,
        ));
        return; // Zero work on previous stops!
      }
    }

    // Case 3: Stops list is identical (e.g. typing in text fields, finish clicked, road changed)
    if (state.stops.length == _drawnStops.length) {
      bool identical = true;
      for (int i = 0; i < state.stops.length; i++) {
        if (_drawnStops[i].id != state.stops[i].id ||
            !_arePointsEqual(_drawnStops[i].position, state.stops[i].position) ||
            _drawnStops[i].number != i + 1) {
          identical = false;
          break;
        }
      }
      if (identical) {
        return; // ZERO TOUCH!
      }
    }

    // Case 4: Stop was deleted (state.stops.length < _drawnStops.length)
    if (state.stops.length < _drawnStops.length) {
      // 1. Remove all old stop markers in parallel using Future.wait
      try {
        await Future.wait(_drawnStops.map((s) async {
          try {
            await mapController.removeMarker(s.position);
          } catch (_) {}
        }));
      } catch (_) {}
      _drawnStops.clear();

      // 2. Re-add the remaining stops with accurate sequential numbers (1, 2, 3...)
      for (int i = 0; i < state.stops.length; i++) {
        final stop = state.stops[i];
        final number = i + 1;
        try {
          await mapController.addMarker(
            stop.position,
            markerIcon: MarkerIcon(
              iconWidget: buildStudioStopMarker(number),
            ),
          );
        } catch (_) {}
        _drawnStops.add(DrawnStop(
          id: stop.id,
          position: stop.position,
          number: number,
        ));
      }
      return;
    }

    // Fallback: For any states the fast paths do not cover (e.g. 2 or more stops queued,
    // reordered, or edited with differing prefix), perform a full clear and redraw.
    await _syncStops(state, force: true);
  }

  bool _isListPrefix(List<GeoPoint> prefix, List<GeoPoint> full) {
    if (prefix.length > full.length) return false;
    for (int i = 0; i < prefix.length; i++) {
      if (!_arePointsEqual(prefix[i], full[i])) return false;
    }
    return true;
  }

  bool _arePointsEqual(GeoPoint a, GeoPoint b) {
    return (a.latitude - b.latitude).abs() < 0.000001 &&
        (a.longitude - b.longitude).abs() < 0.000001;
  }
}
