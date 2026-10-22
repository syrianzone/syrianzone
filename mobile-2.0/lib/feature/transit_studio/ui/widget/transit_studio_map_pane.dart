import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_osm_plugin/flutter_osm_plugin.dart';
import 'package:syrianzone/core/data/model/lng_lat.dart';
import 'package:syrianzone/core/widget/osm_tile.dart';
import 'package:syrianzone/feature/transit_studio/data/model/studio_tool_mode.dart';
import '../../logic/transit_studio_cubit.dart';
import '../../logic/transit_studio_state.dart';
import 'map/studio_map_fab_actions.dart';
import 'map/studio_map_synchronizer.dart';
import 'map/studio_mode_banner.dart';

class TransitStudioMapPane extends StatefulWidget {
  const TransitStudioMapPane({super.key});

  @override
  State<TransitStudioMapPane> createState() => _TransitStudioMapPaneState();
}

class _TransitStudioMapPaneState extends State<TransitStudioMapPane> {
  late final MapController _mapController;
  late final StudioMapSynchronizer _synchronizer;
  bool _isMapReady = false;

  @override
  void initState() {
    super.initState();
    final cubitState = context.read<TransitStudioCubit>().state;
    final initialCenter = cubitState.selectedCity?.center.toGeoPoint() ??
        GeoPoint(latitude: 34.73, longitude: 36.72);

    _mapController = MapController.withPosition(
      initPosition: initialCenter,
    );

    _synchronizer = StudioMapSynchronizer(mapController: _mapController);
  }

  @override
  void dispose() {
    _mapController.dispose();
    super.dispose();
  }

  Future<void> _onMapReady(bool isReady) async {
    if (!mounted) return;
    setState(() {
      _isMapReady = isReady;
      _synchronizer.isMapReady = isReady;
    });

    if (isReady) {
      try {
        await _mapController.changeTileLayer(tileLayer: osmTile);
      } catch (_) {}

      if (!mounted) return;

      final city = context.read<TransitStudioCubit>().state.selectedCity;
      if (city != null) {
        try {
          await _mapController.setZoom(zoomLevel: city.zoom);
        } catch (_) {}
      }

      if (!mounted) return;

      _mapController.listenerMapSingleTapping.addListener(_handleMapTap);

      // Render initial state if any
      final state = context.read<TransitStudioCubit>().state;
      await _synchronizer.sync(state, force: true);
    }
  }

  void _handleMapTap() {
    if (!_isMapReady) return;
    final cubit = context.read<TransitStudioCubit>();
    if (cubit.state.isSubmitting) return;

    final point = _mapController.listenerMapSingleTapping.value;
    if (point == null) return;

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

  void _handleGeoPointClicked(GeoPoint clickedPoint) {
    final cubit = context.read<TransitStudioCubit>();
    if (cubit.state.isSubmitting) return;
    final mode = cubit.state.activeTool;

    if (mode == StudioToolMode.drawRoad) {
      // Check if user clicked an existing road point to select/move it
      final roadPoints = cubit.state.roadPoints;
      for (int i = 0; i < roadPoints.length; i++) {
        if ((roadPoints[i].latitude - clickedPoint.latitude).abs() < 0.0003 &&
            (roadPoints[i].longitude - clickedPoint.longitude).abs() < 0.0003) {
          cubit.selectPointToMove(i);
          return;
        }
      }
      // Otherwise clicking a city marker snaps/adds to road
      cubit.addRoadPoint(clickedPoint);
    } else if (mode == StudioToolMode.addStops) {
      cubit.addStop(clickedPoint);
    } else if (mode == StudioToolMode.movePoint ||
        mode == StudioToolMode.none) {
      final roadPoints = cubit.state.roadPoints;
      for (int i = 0; i < roadPoints.length; i++) {
        if ((roadPoints[i].latitude - clickedPoint.latitude).abs() < 0.0003 &&
            (roadPoints[i].longitude - clickedPoint.longitude).abs() < 0.0003) {
          cubit.selectPointToMove(i);
          return;
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<TransitStudioCubit, TransitStudioState>(
      listener: (context, state) {
        _synchronizer.sync(state);
      },
      builder: (context, state) {
        final initialZoom = state.selectedCity?.zoom ?? 14.0;

        return Stack(
          children: [
            OSMFlutter(
              controller: _mapController,
              onMapIsReady: _onMapReady,
              mapIsLoading: const Center(
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
              onGeoPointClicked: _handleGeoPointClicked,
              osmOption: OSMOption(
                showZoomController: true,
                zoomOption: ZoomOption(
                  initZoom: initialZoom,
                  minZoomLevel: 5,
                  maxZoomLevel: 19,
                ),
              ),
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

            // Floating Quick Actions: User Location & Recenter on City
            Positioned(
              bottom: 12,
              right: 12,
              child: StudioMapFabActions(
                mapController: _mapController,
                selectedCity: state.selectedCity,
                isMapReady: _isMapReady,
              ),
            ),
          ],
        );
      },
    );
  }
}
