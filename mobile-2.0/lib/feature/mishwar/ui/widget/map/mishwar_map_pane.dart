import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:syrianzone/core/constants/map_constants.dart';
import 'package:syrianzone/core/data/model/map_feature_item.dart';
import 'package:syrianzone/core/util/text_util.dart';
import 'package:syrianzone/feature/mishwar/data/map_cluster.dart';
import 'package:syrianzone/feature/mishwar/data/mishwar_map_point.dart';

class MishwarMapPane extends StatefulWidget {
  final List<MapFeatureItem> features;
  final ValueChanged<int>? onPlaceSelected;
  final ValueChanged<int>? onHotelSelected;
  final int? highlightedId;
  final String? highlightedType;
  final bool isPickingLocation;
  final ValueChanged<LatLng>? onLocationPicked;
  final VoidCallback? onCancelLocationPicker;
  final bool isHotelMap;
  final VoidCallback? onClusterTapped;
  final VoidCallback? onMapTapped;
  final double bottomOffsetRatio;

  const MishwarMapPane({
    super.key,
    required this.features,
    this.onPlaceSelected,
    this.onHotelSelected,
    this.highlightedId,
    this.highlightedType,
    this.isPickingLocation = false,
    this.onLocationPicked,
    this.onCancelLocationPicker,
    this.isHotelMap = false,
    this.onClusterTapped,
    this.onMapTapped,
    this.bottomOffsetRatio = 0.0,
  });

  @override
  State<MishwarMapPane> createState() => MishwarMapPaneState();
}

class MishwarMapPaneState extends State<MishwarMapPane> {
  // Website exact design tokens (from PlacesLayer.tsx & HotelsLayer.tsx)
  static const Color placeClusterColor = Color(0xD956644F); // hsl(105, 12%, 38%) @ 85% opacity
  static const Color hotelClusterColor = Color(0xD9C05621); // #c05621 @ 85% opacity
  static const Color placePinColor = Color(0xFF7D8A5C); // #7d8a5c
  static const Color hotelPinColor = Color(0xFFC05621); // #c05621
  static const Color pinHighlightAmber = Color(0xFFD97706); // amber glow

  late final MapController _mapController;
  LatLng? _userMarkerLatLng;
  LatLng? _highlightedMarker;
  StreamSubscription<Position>? _positionStreamSubscription;
  bool _isLoadingUserLocation = false;
  double _currentZoom = MapConstants.mishwarInitialZoom;

  // Memoized clustering state
  int _lastComputedTier = -1;
  List<MapFeatureItem>? _lastFeatures;
  bool? _lastIsHotelMap;
  int? _lastHighlightedId;
  List<MapCluster> _cachedClusters = const [];

  @override
  void initState() {
    super.initState();
    _mapController = MapController();
    _recomputeClustersIfNeeded();
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
  void didUpdateWidget(covariant MishwarMapPane oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.highlightedId != oldWidget.highlightedId ||
        widget.highlightedType != oldWidget.highlightedType) {
      if (widget.highlightedId == null) {
        _highlightedMarker = null;
      }
    }
  }

  /// Exact zoom cutoff matching website (clusterMaxZoom: 10)
  int _getZoomTier(double zoom) {
    if (zoom > MapConstants.clusterMaxZoom) return -1; // Unclustered individual pins (clusterMaxZoom: 10 on web)
    return (zoom * 2).floor(); // 0.5 zoom steps
  }

  double _getVerticalViewportOffset() {
    if (widget.bottomOffsetRatio <= 0.0) return 0.0;
    try {
      final mapHeight = _mapController.camera.nonRotatedSize.height;
      if (mapHeight <= 0.0) return 0.0;
      final coveredHeight = mapHeight * widget.bottomOffsetRatio;
      return -(coveredHeight / 2);
    } catch (_) {
      return 0.0;
    }
  }

  Future<void> zoomToLocation(
    double lat,
    double lng, {
    double zoom = MapConstants.detailZoom,
    Offset? offset,
  }) async {
    if (!mounted) return;
    final point = LatLng(lat, lng);
    setState(() {
      _highlightedMarker = point;
      _currentZoom = zoom;
    });

    try {
      final effectiveOffset = offset ?? Offset(0, _getVerticalViewportOffset());
      _mapController.move(point, zoom, offset: effectiveOffset);
    } catch (_) {}
  }

  void _recomputeClustersIfNeeded() {
    final currentTier = _getZoomTier(_currentZoom);
    final featuresChanged = !identical(widget.features, _lastFeatures);
    final hotelMapChanged = widget.isHotelMap != _lastIsHotelMap;
    final highlightChanged = widget.highlightedId != _lastHighlightedId;

    if (currentTier == _lastComputedTier &&
        !featuresChanged &&
        !hotelMapChanged &&
        !highlightChanged) {
      return;
    }

    _lastComputedTier = currentTier;
    _lastFeatures = widget.features;
    _lastIsHotelMap = widget.isHotelMap;
    _lastHighlightedId = widget.highlightedId;

    final points = <MishwarMapPoint>[];
    for (final f in widget.features) {
      final isHotel = (f.mapType == 'hotel') || widget.isHotelMap;
      points.add(
        MishwarMapPoint(
          id: f.id,
          name: f.displayName,
          lat: f.latitude,
          lng: f.longitude,
          type: isHotel ? 'hotel' : 'place',
        ),
      );
    }

    // Dynamic radius matching website clusterRadius: 25px
    // At zoom z, 25px corresponds to 35.16 / (1 << z) degrees
    final clusterRadius = currentTier == -1
        ? 0.0
        : (35.16 / (1 << _currentZoom.clamp(5, 10).floor()));

    _cachedClusters = _computeClusters(points, clusterRadius);
  }

  List<MapCluster> _computeClusters(List<MishwarMapPoint> points, double clusterRadius) {
    if (clusterRadius <= 0.0) {
      return points.map((p) => MapCluster(lat: p.lat, lng: p.lng, points: [p])).toList();
    }

    final clusters = <MapCluster>[];
    for (final p in points) {
      final isItemHighlighted = widget.highlightedId != null &&
          p.id == widget.highlightedId &&
          (widget.highlightedType == null || p.type == widget.highlightedType);

      if (isItemHighlighted) {
        clusters.add(MapCluster(lat: p.lat, lng: p.lng, points: [p]));
        continue;
      }

      bool added = false;
      for (final c in clusters) {
        final hasHighlighted = widget.highlightedId != null &&
            c.points.any((pt) =>
                pt.id == widget.highlightedId &&
                (widget.highlightedType == null || pt.type == widget.highlightedType));
        if (hasHighlighted) {
          continue;
        }
        final dLat = (c.lat - p.lat).abs();
        final dLng = (c.lng - p.lng).abs();
        if (dLat < clusterRadius && dLng < clusterRadius) {
          c.addPoint(p);
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

  Widget _buildNormalMarkerWidget({required bool isHotel, required bool isSelected}) {
    // Normal circle: 12px. Selected circle: 20px (same circle shape, bigger to indicate selection)
    final size = isSelected ? 20.0 : 12.0;
    final color = isHotel ? hotelPinColor : placePinColor;

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        border: Border.all(
          color: Colors.white,
          width: isSelected ? 2.5 : 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: isSelected ? const Color(0x77000000) : Colors.black26,
            blurRadius: isSelected ? 6 : 3,
            offset: isSelected ? const Offset(0, 2) : Offset.zero,
          ),
        ],
      ),
    );
  }

  Widget _buildClusterMarkerWidget({
    required int count,
    required bool isHotel,
    required double size,
  }) {
    final bgColor = isHotel ? hotelClusterColor : placeClusterColor;

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: bgColor,
        shape: BoxShape.circle,
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.8),
          width: 1.5,
        ),
        boxShadow: const [
          BoxShadow(color: Colors.black38, blurRadius: 5),
        ],
      ),
      alignment: Alignment.center,
      child: Text(
        TextUtil.toArabicDigits(count),
        style: const TextStyle(
          color: Colors.white,
          fontSize: 11, // Matching website text-size: 11
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  void _handleClusterClicked(MapCluster cluster) {
    final point = LatLng(cluster.lat, cluster.lng);

    if (widget.isPickingLocation) {
      widget.onLocationPicked?.call(point);
      return;
    }

    if (cluster.isSingle) {
      final item = cluster.points.first;
      if (item.type == 'hotel') {
        widget.onHotelSelected?.call(item.id);
      } else {
        widget.onPlaceSelected?.call(item.id);
      }
      return;
    }

    // Website behavior: zoom in a small step (+1.2) while maintaining the cluster center
    widget.onClusterTapped?.call();
    final nextZoom = (_currentZoom + MapConstants.clusterStepZoom)
        .clamp(MapConstants.mishwarMinZoom, MapConstants.maxZoom);
    final yOffset = _getVerticalViewportOffset();
    _mapController.move(point, nextZoom, offset: Offset(0, yOffset));
    setState(() {
      _currentZoom = nextZoom;
    });
  }

  List<Marker> _buildMarkers() {
    _recomputeClustersIfNeeded();

    if (_cachedClusters.isEmpty && _highlightedMarker == null && _userMarkerLatLng == null) {
      return const [];
    }

    final markers = <Marker>[];
    bool hasDrawnHighlighted = false;

    for (final cluster in _cachedClusters) {
      final geoPoint = LatLng(cluster.lat, cluster.lng);

      final isHighlighted = (widget.highlightedId != null &&
              cluster.points.any((p) =>
                  p.id == widget.highlightedId &&
                  (widget.highlightedType == null || p.type == widget.highlightedType))) ||
          (_highlightedMarker != null &&
              (geoPoint.latitude - _highlightedMarker!.latitude).abs() < 0.0003 &&
              (geoPoint.longitude - _highlightedMarker!.longitude).abs() < 0.0003);

      if (isHighlighted) {
        hasDrawnHighlighted = true;
      }

      final isHotel = cluster.points.first.type == 'hotel' || widget.isHotelMap;

      if (cluster.isSingle) {
        final hitSize = isHighlighted ? 36.0 : 28.0;
        markers.add(
          Marker(
            point: geoPoint,
            width: hitSize,
            height: hitSize,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => _handleClusterClicked(cluster),
              child: Center(
                child: _buildNormalMarkerWidget(isHotel: isHotel, isSelected: isHighlighted),
              ),
            ),
          ),
        );
      } else {
        final isHotelCluster = cluster.points.any((p) => p.type == 'hotel') || widget.isHotelMap;
        final count = cluster.points.length;

        // Website step: <10: 20px, 10-29: 26px, >=30: 32px
        final size = count < 10 ? 20.0 : (count < 30 ? 26.0 : 32.0);
        final hitSize = size < 28.0 ? 28.0 : size;

        markers.add(
          Marker(
            point: geoPoint,
            width: hitSize,
            height: hitSize,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => _handleClusterClicked(cluster),
              child: Center(
                child: _buildClusterMarkerWidget(
                  count: count,
                  isHotel: isHotelCluster,
                  size: size,
                ),
              ),
            ),
          ),
        );
      }
    }

    if (_highlightedMarker != null && !hasDrawnHighlighted) {
      markers.add(
        Marker(
          point: _highlightedMarker!,
          width: 36,
          height: 36,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () {
              if (widget.isPickingLocation) {
                widget.onLocationPicked?.call(_highlightedMarker!);
              }
            },
            child: Center(
              child: _buildNormalMarkerWidget(
                isHotel: widget.isHotelMap || widget.highlightedType == 'hotel',
                isSelected: true,
              ),
            ),
          ),
        ),
      );
    }

    if (_userMarkerLatLng != null) {
      markers.add(
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
      );
    }

    return markers;
  }

  Future<void> _initUserLocation({bool centerOnUser = false}) async {
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (centerOnUser && permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      final hasPermission = permission == LocationPermission.always ||
          permission == LocationPermission.whileInUse;
      if (!hasPermission) return;

      if (centerOnUser && mounted) {
        setState(() => _isLoadingUserLocation = true);
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          timeLimit: Duration(seconds: 4),
        ),
      );

      if (!mounted) return;

      final point = LatLng(position.latitude, position.longitude);
      setState(() {
        _userMarkerLatLng = point;
      });

      if (centerOnUser) {
        _mapController.move(point, MapConstants.userLocationZoom);
        setState(() {
          _currentZoom = MapConstants.userLocationZoom;
        });
      }
    } catch (_) {
    } finally {
      if (mounted && _isLoadingUserLocation) {
        setState(() => _isLoadingUserLocation = false);
      }
    }
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
                  child: SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                )
              : Icon(icon, color: iconColor, size: 20),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        FlutterMap(
          mapController: _mapController,
          options: MapOptions(
            initialCenter: MapConstants.defaultCenter,
            initialZoom: MapConstants.mishwarInitialZoom,
            minZoom: MapConstants.mishwarMinZoom,
            maxZoom: MapConstants.maxZoom,
            interactionOptions: const InteractionOptions(
              flags: InteractiveFlag.all,
            ),
            onTap: (tapPosition, point) {
              if (widget.isPickingLocation) {
                widget.onLocationPicked?.call(point);
              } else {
                widget.onMapTapped?.call();
              }
            },
            onPositionChanged: (camera, hasGesture) {
              final newZoom = camera.zoom;
              if (_getZoomTier(newZoom) != _getZoomTier(_currentZoom) || !hasGesture) {
                setState(() {
                  _currentZoom = newZoom;
                });
              }
            },
          ),
          children: [
            MapConstants.cartoDarkTileLayer,
            MarkerLayer(
              markers: _buildMarkers(),
            ),
          ],
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
                onTap: () {
                  final nextZoom = (_currentZoom + 1)
                      .clamp(MapConstants.mishwarMinZoom, MapConstants.maxZoom);
                  _mapController.move(_mapController.camera.center, nextZoom);
                  setState(() {
                    _currentZoom = nextZoom;
                  });
                },
              ),
              const SizedBox(height: 6),
              _buildMapButton(
                icon: Icons.remove,
                onTap: () {
                  final nextZoom = (_currentZoom - 1)
                      .clamp(MapConstants.mishwarMinZoom, MapConstants.maxZoom);
                  _mapController.move(_mapController.camera.center, nextZoom);
                  setState(() {
                    _currentZoom = nextZoom;
                  });
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
}
