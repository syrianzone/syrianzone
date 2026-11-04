import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_osm_plugin/flutter_osm_plugin.dart';
import 'package:geolocator/geolocator.dart';
import 'package:syrianzone/core/constants/map_constants.dart';
import 'package:syrianzone/core/network/response/places_map_response.dart';
import 'package:syrianzone/core/util/text_util.dart';
import 'package:syrianzone/feature/mishwar/data/map_cluster.dart';
import 'package:syrianzone/feature/mishwar/data/mishwar_map_point.dart';

class MishwarMapPane extends StatefulWidget {
  final List<PlaceMapFeature> features;
  final ValueChanged<int>? onPlaceSelected;
  final ValueChanged<int>? onHotelSelected;
  final int? highlightedId;
  final bool isPickingLocation;
  final ValueChanged<GeoPoint>? onLocationPicked;
  final VoidCallback? onCancelLocationPicker;
  final bool isHotelMap;

  const MishwarMapPane({
    super.key,
    required this.features,
    this.onPlaceSelected,
    this.onHotelSelected,
    this.highlightedId,
    this.isPickingLocation = false,
    this.onLocationPicked,
    this.onCancelLocationPicker,
    this.isHotelMap = false,
  });

  @override
  State<MishwarMapPane> createState() => MishwarMapPaneState();
}

class MishwarMapPaneState extends State<MishwarMapPane> {
  late final MapController _mapController;
  bool _isMapReady = false;
  final List<GeoPoint> _drawnMarkers = <GeoPoint>[];
  final Map<String, MapCluster> _clusterByCoordinate = {};

  GeoPoint? _userMarkerGeoPoint;
  GeoPoint? _highlightedMarker;
  GeoPoint? _pendingTargetLocation;
  StreamSubscription<Position>? _positionStreamSubscription;
  bool _isLoadingUserLocation = false;
  double _currentZoom = 7.0;

  @override
  void initState() {
    super.initState();
    _mapController = MapController.withPosition(
      initPosition: GeoPoint(
        latitude: MapConstants.defaultLat,
        longitude: MapConstants.defaultLon,
      ),
    );
    _mapController.listenerMapSingleTapping.addListener(_onMapTapped);
  }

  void _onMapTapped() {
    final point = _mapController.listenerMapSingleTapping.value;
    if (point != null && widget.isPickingLocation) {
      widget.onLocationPicked?.call(point);
    }
  }

  @override
  void dispose() {
    _mapController.listenerMapSingleTapping.removeListener(_onMapTapped);
    _positionStreamSubscription?.cancel();
    _positionStreamSubscription = null;
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant MishwarMapPane oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.highlightedId != oldWidget.highlightedId) {
      if (widget.highlightedId == null) {
        _highlightedMarker = null;
      }
      _renderMarkers();
    } else if (widget.features != oldWidget.features || widget.isHotelMap != oldWidget.isHotelMap) {
      _renderMarkers();
    }
  }

  Future<void> zoomToLocation(double lat, double lng, {double zoom = 15.0}) async {
    final point = GeoPoint(latitude: lat, longitude: lng);
    _highlightedMarker = point;
    _currentZoom = zoom;

    if (!_isMapReady) {
      _pendingTargetLocation = point;
      return;
    }

    try {
      await _mapController.moveTo(point);
      await _mapController.setZoom(zoomLevel: zoom);
      await _renderMarkers();
    } catch (_) {}
  }

  List<MapCluster> _computeClusters(List<MishwarMapPoint> points, double clusterRadius) {
    if (clusterRadius <= 0.0) {
      return points.map((p) => MapCluster(lat: p.lat, lng: p.lng, points: [p])).toList();
    }

    final clusters = <MapCluster>[];
    for (final p in points) {
      // Highlighted point is never clustered with other points so it always stands out
      if (widget.highlightedId != null && p.id == widget.highlightedId) {
        clusters.add(MapCluster(lat: p.lat, lng: p.lng, points: [p]));
        continue;
      }

      bool added = false;
      for (final c in clusters) {
        if (widget.highlightedId != null && c.points.any((pt) => pt.id == widget.highlightedId)) {
          continue;
        }
        final dLat = (c.lat - p.lat).abs();
        final dLng = (c.lng - p.lng).abs();
        if (dLat < clusterRadius && dLng < clusterRadius) {
          c.points.add(p);
          added = true;
          break;
        }
      }
      if (!added) {
        clusters.add(MapCluster(lat: p.lat, lng: p.lng, points: [p]));
      }
    }
    return clusters;
  }

  Widget _buildHighlightedMarkerWidget() {
    return Stack(
      alignment: Alignment.center,
      children: [
        // Pulsing glowing amber halo
        Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: const Color(0xFFD97706).withValues(alpha: 0.35),
            shape: BoxShape.circle,
          ),
        ),
        // Selected Pin
        Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: const Color(0xFFD97706),
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 2.5),
            boxShadow: const [
              BoxShadow(
                color: Color(0x66000000),
                blurRadius: 8,
                offset: Offset(0, 3),
              ),
            ],
          ),
          child: const Icon(Icons.place, size: 16, color: Colors.white),
        ),
      ],
    );
  }

  Widget _buildNormalMarkerWidget({required bool isHotel}) {
    return Container(
      width: 16,
      height: 16,
      decoration: BoxDecoration(
        color: isHotel ? const Color(0xFFDC2626) : const Color(0xFF4A7C38),
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 2),
        boxShadow: const [
          BoxShadow(color: Colors.black26, blurRadius: 4),
        ],
      ),
    );
  }

  Widget _buildClusterMarkerWidget({
    required int count,
    required bool isHotel,
    required double size,
  }) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: isHotel
            ? const Color(0xFFDC2626).withValues(alpha: 0.92)
            : const Color(0xFF456B34).withValues(alpha: 0.92),
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 2),
        boxShadow: const [
          BoxShadow(color: Colors.black38, blurRadius: 6),
        ],
      ),
      alignment: Alignment.center,
      child: Text(
        TextUtil.toArabicDigits(count),
        style: const TextStyle(
          color: Colors.white,
          fontSize: 12,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  Future<void> _renderMarkers() async {
    if (!_isMapReady) return;

    try {
      if (_drawnMarkers.isNotEmpty) {
        await _mapController.removeMarkers(_drawnMarkers);
        _drawnMarkers.clear();
      }
      _clusterByCoordinate.clear();

      final points = <MishwarMapPoint>[];
      for (final f in widget.features) {
        final coords = f.geometry.coordinates;
        if (coords.length >= 2) {
          final isHotel = (f.properties.type == 'hotel') || widget.isHotelMap;
          points.add(
            MishwarMapPoint(
              id: f.properties.id,
              name: f.properties.name,
              lat: coords[1],
              lng: coords[0],
              type: isHotel ? 'hotel' : 'place',
            ),
          );
        }
      }

      if (points.isEmpty) return;

      // Group into clusters if zoomed out, or single points if zoomed in (zoom >= 13)
      final clusterRadius = _currentZoom < 9.0
          ? 0.45
          : _currentZoom < 13.0
              ? 0.12
              : 0.0;

      final clusters = _computeClusters(points, clusterRadius);

      final markerFutures = <Future<void>>[];
      for (final cluster in clusters) {
        final geoPoint = GeoPoint(latitude: cluster.lat, longitude: cluster.lng);
        final key = '${geoPoint.latitude.toStringAsFixed(4)},${geoPoint.longitude.toStringAsFixed(4)}';
        _clusterByCoordinate[key] = cluster;
        _drawnMarkers.add(geoPoint);

        final isHighlighted = (widget.highlightedId != null &&
                cluster.points.any((p) => p.id == widget.highlightedId)) ||
            (_highlightedMarker != null &&
                (geoPoint.latitude - _highlightedMarker!.latitude).abs() < 0.0003 &&
                (geoPoint.longitude - _highlightedMarker!.longitude).abs() < 0.0003);

        final isHotel = cluster.points.first.type == 'hotel' || widget.isHotelMap;

        if (cluster.isSingle) {
          // Single green point for place, red for hotel (or highlighted amber)
          markerFutures.add(
            _mapController.addMarker(
              geoPoint,
              markerIcon: MarkerIcon(
                iconWidget: isHighlighted
                    ? _buildHighlightedMarkerWidget()
                    : _buildNormalMarkerWidget(isHotel: isHotel),
              ),
            ),
          );
        } else {
          // Cluster circle with count
          final isHotelCluster = cluster.points.any((p) => p.type == 'hotel') || widget.isHotelMap;
          final count = cluster.points.length;
          final size = (28.0 + (count > 20 ? 12.0 : (count > 5 ? 6.0 : 0.0))).clamp(28.0, 42.0);
          markerFutures.add(
            _mapController.addMarker(
              geoPoint,
              markerIcon: MarkerIcon(
                iconWidget: _buildClusterMarkerWidget(
                  count: count,
                  isHotel: isHotelCluster,
                  size: size,
                ),
              ),
            ),
          );
        }
      }

      // If a point was explicitly highlighted and not part of the drawn clusters
      final hasDrawnHighlighted = _drawnMarkers.any((m) =>
          _highlightedMarker != null &&
          (m.latitude - _highlightedMarker!.latitude).abs() < 0.0003 &&
          (m.longitude - _highlightedMarker!.longitude).abs() < 0.0003);

      if (_highlightedMarker != null && !hasDrawnHighlighted) {
        _drawnMarkers.add(_highlightedMarker!);
        markerFutures.add(
          _mapController.addMarker(
            _highlightedMarker!,
            markerIcon: MarkerIcon(
              iconWidget: _buildHighlightedMarkerWidget(),
            ),
          ),
        );
      }

      await Future.wait(markerFutures);
    } catch (_) {}
  }

  void _handleMarkerClicked(GeoPoint point) async {
    if (widget.isPickingLocation) {
      widget.onLocationPicked?.call(point);
      return;
    }

    final key = '${point.latitude.toStringAsFixed(4)},${point.longitude.toStringAsFixed(4)}';
    final cluster = _clusterByCoordinate[key];
    if (cluster == null) return;

    if (cluster.isSingle) {
      final item = cluster.points.first;
      if (item.type == 'hotel') {
        widget.onHotelSelected?.call(item.id);
      } else {
        widget.onPlaceSelected?.call(item.id);
      }
    } else {
      // Zoom into the cluster
      await _mapController.moveTo(point);
      await _mapController.zoomIn();
      _currentZoom += 2;
      _renderMarkers();
    }
  }

  Future<void> _initUserLocation({bool centerOnUser = false}) async {
    if (!mounted || !_isMapReady) return;

    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (centerOnUser && permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      final hasPermission = permission == LocationPermission.always ||
          permission == LocationPermission.whileInUse;
      if (!hasPermission) return;

      if (centerOnUser) {
        setState(() => _isLoadingUserLocation = true);
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          timeLimit: Duration(seconds: 4),
        ),
      );

      final point = GeoPoint(latitude: position.latitude, longitude: position.longitude);

      if (_userMarkerGeoPoint != null) {
        try {
          await _mapController.removeMarker(_userMarkerGeoPoint!);
        } catch (_) {}
      }

      _userMarkerGeoPoint = point;
      await _mapController.addMarker(
        point,
        markerIcon: const MarkerIcon(
          icon: Icon(Icons.my_location, color: Colors.blueAccent, size: 28),
        ),
      );

      if (centerOnUser) {
        await _mapController.moveTo(point);
        await _mapController.setZoom(zoomLevel: 14);
      }
    } catch (_) {
    } finally {
      if (mounted && _isLoadingUserLocation) {
        setState(() => _isLoadingUserLocation = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        OSMFlutter(
          controller: _mapController,
          onMapIsReady: (isReady) async {
            _isMapReady = isReady;
            if (isReady) {
              await _mapController.changeTileLayer(tileLayer: MapConstants.cartoDarkTileLayer);
              if (_pendingTargetLocation != null) {
                final target = _pendingTargetLocation!;
                _pendingTargetLocation = null;
                await zoomToLocation(target.latitude, target.longitude);
              } else {
                await _renderMarkers();
              }
              _initUserLocation(centerOnUser: false);
            }
          },
          mapIsLoading: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
          onGeoPointClicked: _handleMarkerClicked,
          osmOption: const OSMOption(
            showZoomController: false,
            zoomOption: ZoomOption(initZoom: 7, minZoomLevel: 5, maxZoomLevel: 19),
          ),
        ),

        // Controls overlay (Zoom +/- & My Location)
        Positioned(
          left: 16,
          top: 70,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildMapButton(
                icon: Icons.add,
                onTap: () async {
                  await _mapController.zoomIn();
                  _currentZoom += 1;
                  await _renderMarkers();
                },
              ),
              const SizedBox(height: 6),
              _buildMapButton(
                icon: Icons.remove,
                onTap: () async {
                  await _mapController.zoomOut();
                  _currentZoom -= 1;
                  await _renderMarkers();
                },
              ),
              const SizedBox(height: 10),
              _buildMapButton(
                icon: Icons.my_location_rounded,
                isLoading: _isLoadingUserLocation,
                iconColor: const Color(0xFF1A73E8),
                onTap: () => _initUserLocation(centerOnUser: true),
              ),
            ],
          ),
        ),

        // Indicator banner for location picking
        if (widget.isPickingLocation)
          Positioned(
            top: 16,
            left: 16,
            right: 16,
            child: Directionality(
              textDirection: TextDirection.rtl,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFF2F2722),
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x33000000),
                      blurRadius: 10,
                      offset: Offset(0, 3),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.add_location_alt_outlined,
                      color: Color(0xFFE2A03F),
                      size: 22,
                    ),
                    const SizedBox(width: 10),
                    const Expanded(
                      child: Text(
                        'حدد نقطة على الخريطة لإضافة المكان',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    InkWell(
                      onTap: widget.onCancelLocationPicker,
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.15),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.close, size: 16, color: Colors.white),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildMapButton({
    required IconData icon,
    required VoidCallback onTap,
    bool isLoading = false,
    Color iconColor = const Color(0xFF2F2722),
  }) {
    return Container(
      width: 38,
      height: 38,
      decoration: BoxDecoration(
        color: Colors.white,
        shape: BoxShape.circle,
        border: Border.all(color: const Color(0xFFE4D8C8)),
        boxShadow: const [
          BoxShadow(color: Color(0x22000000), blurRadius: 6, offset: Offset(0, 2)),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: isLoading ? null : onTap,
          child: isLoading
              ? const Center(
                  child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)),
                )
              : Icon(icon, color: iconColor, size: 20),
        ),
      ),
    );
  }
}
