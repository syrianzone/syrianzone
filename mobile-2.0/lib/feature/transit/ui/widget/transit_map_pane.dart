import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:syrianzone/core/constants/map_constants.dart';
import 'package:syrianzone/core/constants/route_palette.dart';
import 'package:syrianzone/core/data/model/lng_lat.dart';
import 'package:syrianzone/core/network/response/map_data_response.dart';
import 'package:syrianzone/core/util/color_util.dart';
import 'package:syrianzone/core/util/map_util.dart';
import 'package:syrianzone/feature/transit/ui/widget/nearby_stops_bottom_sheet.dart';

class TransitMapPane extends StatefulWidget {
  const TransitMapPane({
    super.key,
    this.latitude,
    this.longitude,
    this.zoom,
    this.mapData,
    this.selectedRouteId,
  });

  final double? latitude;
  final double? longitude;
  final double? zoom;
  final MapDataResponse? mapData;
  final String? selectedRouteId;

  @override
  State<TransitMapPane> createState() => _TransitMapPaneState();
}

class _TransitMapPaneState extends State<TransitMapPane> {
  late final MapController _mapController;
  MapStopFeature? _selectedStop;
  LatLng? _selectedLatLng;
  LatLng? _userMarkerLatLng;
  StreamSubscription<Position>? _positionStreamSubscription;
  bool _isLoadingUserLocation = false;

  // Memoized polylines and markers (recomputed only on mapData or selectedRouteId change)
  List<Polyline> _cachedPolylines = const [];
  List<Marker> _cachedStopMarkers = const [];

  @override
  void initState() {
    super.initState();
    _mapController = MapController();
    _rebuildMapLayers();
    _initUserLocation(centerOnUser: false);
  }

  @override
  void dispose() {
    _positionStreamSubscription?.cancel();
    _positionStreamSubscription = null;
    _mapController.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant TransitMapPane oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.mapData != oldWidget.mapData ||
        widget.selectedRouteId != oldWidget.selectedRouteId) {
      if (_selectedStop != null) {
        _selectedStop = null;
        _selectedLatLng = null;
      }
      _rebuildMapLayers();
    }
  }

  void _rebuildMapLayers() {
    _cachedPolylines = _computePolylines();
    _cachedStopMarkers = _computeStopMarkers();
  }

  void _handleStopClicked(MapStopFeature stop, LatLng point) {
    setState(() {
      _selectedStop = stop;
      _selectedLatLng = point;
    });
  }

  String _getRouteLabel(MapStopFeature stop) {
    final stopRouteIds = stop.properties.routeIds;
    if (widget.selectedRouteId != null &&
        stopRouteIds.contains(widget.selectedRouteId)) {
      return 'مسار ${widget.selectedRouteId}';
    }
    if (stopRouteIds.isNotEmpty) {
      return 'مسار ${stopRouteIds.first}';
    }
    return '';
  }

  Color _getRouteColor(MapStopFeature stop) {
    const fallbackColor = Color(0xFFA33838);
    final stopRouteIds = stop.properties.routeIds;
    final targetRouteId =
        (widget.selectedRouteId != null &&
            stopRouteIds.contains(widget.selectedRouteId))
        ? widget.selectedRouteId!
        : (stopRouteIds.isNotEmpty ? stopRouteIds.first : null);

    if (targetRouteId != null && widget.mapData != null) {
      for (final route in widget.mapData!.routes.features) {
        if (route.properties.id == targetRouteId) {
          return ColorUtil.hexToColor(
            RoutePalette.colorForIndexOrDefault(route.properties.colorIndex),
          );
        }
      }
    }
    return fallbackColor;
  }

  Widget _buildStopCard(MapStopFeature stop) {
    final bannerColor = _getRouteColor(stop);
    final routeLabel = _getRouteLabel(stop);

    return Material(
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0xFFE4D8C8)),
      ),
      elevation: 6,
      shadowColor: const Color(0x33000000),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () {
          if (_selectedLatLng != null) {
            MapUtil.openMapApp(
              _selectedLatLng!.latitude,
              _selectedLatLng!.longitude,
              label: stop.properties.nameAr,
            );
          }
        },
        child: Stack(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    stop.properties.nameAr,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF2F2722),
                    ),
                  ),
                  if (routeLabel.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 10,
                      ),
                      decoration: BoxDecoration(
                        color: bannerColor,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        routeLabel,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          height: 1.3,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            Positioned(
              top: 8,
              left: 8,
              child: GestureDetector(
                onTap: () {
                  setState(() {
                    _selectedStop = null;
                    _selectedLatLng = null;
                  });
                },
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: const BoxDecoration(
                    color: Color(0xFFEDE6DD),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.close,
                    size: 16,
                    color: Color(0xFF5A4D41),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNearbyButton() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
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
        child: InkWell(
          borderRadius: BorderRadius.circular(24),
          onTap: () {
            NearbyStopsBottomSheet.show(
              context,
              onStopSelected: (stop) {
                Navigator.pop(context);
                if (stop.coordinates.length >= 2) {
                  final target = LatLng(
                    stop.coordinates[1],
                    stop.coordinates[0],
                  );
                  _mapController.move(target, _mapController.camera.zoom);

                  MapStopFeature? matched;
                  if (widget.mapData != null) {
                    for (final f in widget.mapData!.stops.features) {
                      if (f.properties.id == stop.id ||
                          (f.geometry.coordinates.length >= 2 &&
                              (f.geometry.coordinates[0] - stop.coordinates[0]).abs() < 0.0001 &&
                              (f.geometry.coordinates[1] - stop.coordinates[1]).abs() < 0.0001)) {
                        matched = f;
                        break;
                      }
                    }
                  }

                  final stopRouteIds = stop.routes
                      .map((r) => r['id']?.toString() ?? '')
                      .where((id) => id.isNotEmpty)
                      .toList();

                  matched ??= MapStopFeature(
                    type: 'Feature',
                    geometry: MapPointGeometry(
                      type: 'Point',
                      coordinates: stop.coordinates,
                    ),
                    properties: MapStopProperties(
                      id: stop.id,
                      nameAr: stop.nameAr,
                      routeIds: stopRouteIds,
                    ),
                  );

                  _handleStopClicked(matched, target);
                }
              },
            );
          },
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              textDirection: TextDirection.rtl,
              children: const [
                Icon(
                  Icons.near_me_rounded,
                  color: Color(0xFFC4862E),
                  size: 20,
                ),
                SizedBox(width: 6),
                Text(
                  'المواقف القريبة',
                  style: TextStyle(
                    color: Color(0xFF2F2722),
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _initUserLocation({bool centerOnUser = false}) async {
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (centerOnUser && permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      final hasPermission = permission == LocationPermission.always ||
          permission == LocationPermission.whileInUse;
      if (!hasPermission) {
        if (centerOnUser && mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('يرجى منح إذن الوصول إلى الموقع'),
              duration: Duration(seconds: 2),
            ),
          );
        }
        return;
      }

      if (!mounted) return;

      if (centerOnUser) {
        setState(() => _isLoadingUserLocation = true);
      }

      Position? position;
      final isServiceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!mounted) return;

      if (isServiceEnabled) {
        try {
          position = await Geolocator.getCurrentPosition(
            locationSettings: const LocationSettings(
              accuracy: LocationAccuracy.medium,
              timeLimit: Duration(seconds: 4),
            ),
          );
        } catch (_) {
          position = await Geolocator.getLastKnownPosition();
        }
      } else {
        position = await Geolocator.getLastKnownPosition();
      }

      if (!mounted) return;

      if (position != null) {
        final point = LatLng(position.latitude, position.longitude);
        setState(() {
          _userMarkerLatLng = point;
        });

        if (centerOnUser && mounted) {
          _mapController.move(point, MapConstants.detailZoom);
        }

        if (isServiceEnabled && _positionStreamSubscription == null && mounted) {
          _positionStreamSubscription = Geolocator.getPositionStream(
            locationSettings: const LocationSettings(
              accuracy: LocationAccuracy.high,
              distanceFilter: 10,
            ),
          ).listen(
            (pos) {
              if (mounted) {
                setState(() {
                  _userMarkerLatLng = LatLng(pos.latitude, pos.longitude);
                });
              }
            },
            onError: (_) {},
          );
        }
      } else if (centerOnUser && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('تعذر تحديد موقعك، يرجى تفعيل خدمة الموقع (GPS)'),
            duration: Duration(seconds: 2),
          ),
        );
      }
    } catch (_) {
      // Ignore background errors
    } finally {
      if (mounted && _isLoadingUserLocation) {
        setState(() => _isLoadingUserLocation = false);
      }
    }
  }

  Widget _buildMyLocationButton() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        shape: BoxShape.circle,
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
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: _isLoadingUserLocation
              ? null
              : () => _initUserLocation(centerOnUser: true),
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: _isLoadingUserLocation
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(
                    Icons.my_location_rounded,
                    color: Color(0xFF1A73E8),
                    size: 20,
                  ),
          ),
        ),
      ),
    );
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

  List<Polyline> _computePolylines() {
    if (widget.mapData == null) return const [];
    final selectedRouteId = widget.selectedRouteId;
    final routeFeatures = selectedRouteId == null
        ? widget.mapData!.routes.features
        : widget.mapData!.routes.features
            .where((route) => route.properties.id == selectedRouteId)
            .toList();

    final polylines = <Polyline>[];
    for (final routeFeature in routeFeatures) {
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
            strokeWidth: 6.0,
          ),
        );
      }
    }
    return polylines;
  }

  List<Marker> _computeStopMarkers() {
    if (widget.mapData == null) return const [];
    final selectedRouteId = widget.selectedRouteId;
    final stopFeatures = selectedRouteId == null
        ? widget.mapData!.stops.features
        : widget.mapData!.stops.features
            .where(
              (stop) => stop.properties.routeIds.contains(selectedRouteId),
            )
            .toList();

    final markers = <Marker>[];
    for (final stopFeature in stopFeatures) {
      if (stopFeature.geometry.type != 'Point') continue;
      final coordinates = stopFeature.geometry.coordinates;
      if (coordinates.length < 2) continue;

      final point = LatLng(coordinates[1], coordinates[0]);
      markers.add(
        Marker(
          point: point,
          width: 28,
          height: 28,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => _handleStopClicked(stopFeature, point),
            child: const Stack(
              alignment: Alignment.center,
              children: [
                Icon(
                  Icons.circle,
                  size: 16.0,
                  color: Colors.white,
                ),
                Icon(
                  Icons.circle,
                  size: 12.0,
                  color: Colors.amber,
                ),
              ],
            ),
          ),
        ),
      );
    }
    return markers;
  }

  @override
  Widget build(BuildContext context) {
    final initCenter = (widget.latitude != null && widget.longitude != null)
        ? LatLng(widget.latitude!, widget.longitude!)
        : MapConstants.defaultCenter;
    final initZoom = widget.zoom ?? MapConstants.transitInitialZoom;

    return Stack(
      children: [
        FlutterMap(
          mapController: _mapController,
          options: MapOptions(
            initialCenter: initCenter,
            initialZoom: initZoom,
            minZoom: MapConstants.minZoom,
            maxZoom: MapConstants.maxZoom,
            interactionOptions: const InteractionOptions(
              flags: InteractiveFlag.all,
            ),
          ),
          children: [
            MapConstants.cartoDarkTileLayer,
            PolylineLayer(
              polylines: _cachedPolylines,
            ),
            MarkerLayer(
              markers: [
                ..._cachedStopMarkers,
                if (_userMarkerLatLng != null)
                  Marker(
                    point: _userMarkerLatLng!,
                    width: 32,
                    height: 32,
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: const Color(0xFF1A73E8).withValues(alpha: 0.25),
                          ),
                        ),
                        const Icon(
                          Icons.circle,
                          size: 22.0,
                          color: Colors.white,
                        ),
                        const Icon(
                          Icons.circle,
                          size: 16.0,
                          color: Color(0xFF1A73E8),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ],
        ),
        Positioned(
          top: 72,
          right: 16,
          child: _buildZoomButtons(),
        ),
        Positioned(
          bottom: _selectedStop != null ? 140 : 16,
          left: 16,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildNearbyButton(),
              const SizedBox(width: 8),
              _buildMyLocationButton(),
            ],
          ),
        ),
        if (_selectedStop != null)
          Positioned(
            bottom: 16,
            left: 20,
            right: 20,
            child: _buildStopCard(_selectedStop!),
          ),
      ],
    );
  }
}
