import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:syrianzone/core/data/model/lng_lat.dart';
import 'package:syrianzone/core/network/response/map_data_response.dart';
import 'package:syrianzone/core/constants/map_constants.dart';
import 'package:syrianzone/core/constants/route_palette.dart';
import 'package:syrianzone/core/util/color_util.dart';
import 'package:syrianzone/feature/transit_studio/data/model/studio_stop.dart';
import 'package:syrianzone/feature/transit_studio/data/model/studio_tool_mode.dart';
import '../../logic/transit_studio_cubit.dart';
import '../../logic/transit_studio_state.dart';
import 'map/studio_map_fab_actions.dart';
import 'map/studio_markers.dart';
import 'map/studio_mode_banner.dart';

class TransitStudioMapPane extends StatefulWidget {
  const TransitStudioMapPane({super.key});

  @override
  State<TransitStudioMapPane> createState() => _TransitStudioMapPaneState();
}

class _TransitStudioMapPaneState extends State<TransitStudioMapPane> {
  late final MapController _mapController;
  LatLng? _userLocation;
  String? _lastCityId;

  // Memoized city layers (recomputed only when cityMapData actually changes)
  MapDataResponse? _cachedCityMapData;
  List<Polyline> _cachedCityPolylines = const [];
  List<Marker> _cachedCityStopMarkers = const [];

  @override
  void initState() {
    super.initState();
    _mapController = MapController();
    final initialState = context.read<TransitStudioCubit>().state;
    _updateCityDataIfNeeded(initialState.cityMapData);
  }

  @override
  void dispose() {
    _mapController.dispose();
    super.dispose();
  }

  void _syncCamera(TransitStudioState state) {
    if (state.selectedCity != null && state.selectedCity!.id != _lastCityId) {
      _lastCityId = state.selectedCity!.id;
      try {
        _mapController.move(
          state.selectedCity!.center.toLatLng(),
          state.selectedCity!.zoom,
        );
      } catch (_) {}
    }
  }

  void _updateCityDataIfNeeded(MapDataResponse? newCityMapData) {
    if (newCityMapData != _cachedCityMapData) {
      _cachedCityMapData = newCityMapData;
      _cachedCityPolylines = _buildCityPolylines(newCityMapData);
      _cachedCityStopMarkers = _buildCityStopMarkers(newCityMapData);
    }
  }

  List<Polyline> _buildCityPolylines(MapDataResponse? cityMapData) {
    if (cityMapData == null) return const [];
    final polylines = <Polyline>[];

    for (final routeFeature in cityMapData.routes.features) {
      if (routeFeature.geometry.type != 'LineString' &&
          routeFeature.geometry.type != 'MultiLineString') {
        continue;
      }

      final roadColor = ColorUtil.hexToColor(
        RoutePalette.colorForIndexOrDefault(
          routeFeature.properties.colorIndex,
        ),
      );

      for (final segment in routeFeature.geometry.segments) {
        final points = segment.map((c) => c.toLatLng()).toList();
        if (points.length < 2) continue;

        polylines.add(
          Polyline(
            points: points,
            color: roadColor,
            strokeWidth: 4.5,
          ),
        );
      }
    }
    return polylines;
  }

  List<Polyline> _buildActiveRoadPolylines(
    List<LatLng> roadPoints,
    Color roadColor,
  ) {
    if (roadPoints.length < 2) return const [];
    return [
      Polyline(
        points: roadPoints,
        color: roadColor,
        strokeWidth: 6.0,
      ),
    ];
  }

  List<Marker> _buildCityStopMarkers(MapDataResponse? cityMapData) {
    if (cityMapData == null) return const [];
    final markers = <Marker>[];

    for (final stopFeature in cityMapData.stops.features) {
      if (stopFeature.geometry.type != 'Point') continue;
      final coords = stopFeature.geometry.coordinates;
      if (coords.length < 2) continue;

      final point = LatLng(coords[1], coords[0]);
      markers.add(
        Marker(
          point: point,
          width: 24,
          height: 24,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => _handleCityStopTap(point),
            child: buildCityStopMarker(),
          ),
        ),
      );
    }
    return markers;
  }

  List<Marker> _buildUserStopMarkers(List<StudioStop> stops) {
    final markers = <Marker>[];
    for (int i = 0; i < stops.length; i++) {
      final stop = stops[i];
      markers.add(
        Marker(
          point: stop.position,
          width: 28,
          height: 28,
          child: buildStudioStopMarker(i + 1),
        ),
      );
    }
    return markers;
  }

  List<Marker> _buildRoadNodeMarkers(
    List<LatLng> roadPoints,
    int? selectedPointIndex,
    Color roadColor,
  ) {
    final markers = <Marker>[];
    for (int i = 0; i < roadPoints.length; i++) {
      final point = roadPoints[i];
      final isSelected = (selectedPointIndex == i);
      final size = isSelected ? 38.0 : 20.0;

      markers.add(
        Marker(
          point: point,
          width: size,
          height: size,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => _handleNodeTap(i),
            child: buildStudioNodeMarker(isSelected, roadColor),
          ),
        ),
      );
    }
    return markers;
  }

  void _handleMapTap(LatLng point) {
    final cubit = context.read<TransitStudioCubit>();
    if (cubit.state.isSubmitting) return;

    final mode = cubit.state.activeTool;

    if (mode == StudioToolMode.drawRoad) {
      cubit.addRoadPoint(point);
    } else if (mode == StudioToolMode.movePoint &&
        cubit.state.selectedPointIndex != null) {
      cubit.moveSelectedPoint(point);
    } else if (mode == StudioToolMode.addStops) {
      cubit.addStop(point);
    }
  }

  void _handleNodeTap(int index) {
    final cubit = context.read<TransitStudioCubit>();
    if (cubit.state.isSubmitting) return;

    final mode = cubit.state.activeTool;
    if (mode == StudioToolMode.drawRoad ||
        mode == StudioToolMode.movePoint ||
        mode == StudioToolMode.none) {
      cubit.selectPointToMove(index);
    } else if (mode == StudioToolMode.addStops) {
      if (index >= 0 && index < cubit.state.roadPoints.length) {
        cubit.addStop(cubit.state.roadPoints[index]);
      }
    }
  }

  void _handleCityStopTap(LatLng stopPoint) {
    final cubit = context.read<TransitStudioCubit>();
    if (cubit.state.isSubmitting) return;

    final mode = cubit.state.activeTool;
    if (mode == StudioToolMode.drawRoad) {
      cubit.addRoadPoint(stopPoint);
    } else if (mode == StudioToolMode.addStops) {
      cubit.addStop(stopPoint);
    }
  }

  Widget _buildZoomButtons() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFE4D8C8)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x22000000),
            blurRadius: 8,
            offset: Offset(0, 3),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            InkWell(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(10)),
              onTap: () {
                final currentZoom = _mapController.camera.zoom;
                if (currentZoom < MapConstants.maxZoom) {
                  _mapController.move(
                    _mapController.camera.center,
                    currentZoom + 1,
                  );
                }
              },
              child: const Padding(
                padding: EdgeInsets.all(8.0),
                child: Icon(
                  Icons.add,
                  size: 20,
                  color: Color(0xFF2F2722),
                ),
              ),
            ),
            const Divider(height: 1, color: Color(0xFFE4D8C8)),
            InkWell(
              borderRadius:
                  const BorderRadius.vertical(bottom: Radius.circular(10)),
              onTap: () {
                final currentZoom = _mapController.camera.zoom;
                if (currentZoom > MapConstants.minZoom) {
                  _mapController.move(
                    _mapController.camera.center,
                    currentZoom - 1,
                  );
                }
              },
              child: const Padding(
                padding: EdgeInsets.all(8.0),
                child: Icon(
                  Icons.remove,
                  size: 20,
                  color: Color(0xFF2F2722),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<TransitStudioCubit, TransitStudioState>(
      listener: (context, state) {
        _syncCamera(state);
        _updateCityDataIfNeeded(state.cityMapData);
      },
      builder: (context, state) {
        final initialCenter = state.selectedCity?.center.toLatLng() ??
            MapConstants.defaultCenter;
        final initialZoom =
            state.selectedCity?.zoom ?? MapConstants.studioInitialZoom;

        return Stack(
          children: [
            FlutterMap(
              mapController: _mapController,
              options: MapOptions(
                initialCenter: initialCenter,
                initialZoom: initialZoom,
                minZoom: MapConstants.mishwarMinZoom,
                maxZoom: MapConstants.maxZoom,
                interactionOptions: const InteractionOptions(
                  flags: InteractiveFlag.all,
                ),
                onTap: (tapPosition, point) => _handleMapTap(point),
              ),
              children: [
                MapConstants.cartoDarkTileLayer,
                // City existing routes (memoized)
                PolylineLayer(
                  polylines: _cachedCityPolylines,
                ),
                // User drawn route (instant in-memory redraw)
                PolylineLayer(
                  polylines: _buildActiveRoadPolylines(
                    state.roadPoints,
                    state.currentColor,
                  ),
                ),
                // City existing stops (memoized)
                MarkerLayer(
                  markers: _cachedCityStopMarkers,
                ),
                // User stops
                MarkerLayer(
                  markers: _buildUserStopMarkers(state.stops),
                ),
                // Road node markers for selection and moving
                MarkerLayer(
                  markers: _buildRoadNodeMarkers(
                    state.roadPoints,
                    state.selectedPointIndex,
                    state.currentColor,
                  ),
                ),
                // User location marker
                if (_userLocation != null)
                  MarkerLayer(
                    markers: [
                      Marker(
                        point: _userLocation!,
                        width: 32,
                        height: 32,
                        child: buildUserLocationMarker(),
                      ),
                    ],
                  ),
              ],
            ),

            // Top progress bar when fetching city map data or submitting route
            if (state.isLoadingMapData || state.isSubmitting)
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: LinearProgressIndicator(
                  minHeight: 3,
                  backgroundColor: Colors.transparent,
                  color: state.isSubmitting
                      ? const Color(0xFF4B7F52)
                      : const Color(0xFFAB6D17),
                ),
              ),

            // Floating Animated Pulse Indicator Banner on top
            if (state.activeTool != StudioToolMode.none)
              Positioned(
                top: 12,
                left: 12,
                right: 12,
                child: StudioModeBanner(state: state),
              ),

            // Zoom in / out controls on top right
            Positioned(
              top: state.activeTool != StudioToolMode.none ? 80 : 16,
              right: 12,
              child: _buildZoomButtons(),
            ),

            // Floating Quick Actions: User Location & Recenter on City
            Positioned(
              bottom: 12,
              right: 12,
              child: StudioMapFabActions(
                mapController: _mapController,
                selectedCity: state.selectedCity,
                onUserLocationChanged: (point) {
                  setState(() {
                    _userLocation = point;
                  });
                },
              ),
            ),
          ],
        );
      },
    );
  }
}
