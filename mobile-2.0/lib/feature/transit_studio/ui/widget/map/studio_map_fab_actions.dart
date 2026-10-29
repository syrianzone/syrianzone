import 'package:flutter/material.dart';
import 'package:flutter_osm_plugin/flutter_osm_plugin.dart';
import 'package:geolocator/geolocator.dart';
import 'package:syrianzone/core/data/model/lng_lat.dart';
import 'package:syrianzone/core/network/response/city_response.dart';
import 'studio_markers.dart';

class StudioMapFabActions extends StatefulWidget {
  final MapController mapController;
  final CityResponse? selectedCity;
  final bool isMapReady;

  const StudioMapFabActions({
    super.key,
    required this.mapController,
    required this.selectedCity,
    required this.isMapReady,
  });

  @override
  State<StudioMapFabActions> createState() => _StudioMapFabActionsState();
}

class _StudioMapFabActionsState extends State<StudioMapFabActions> {
  GeoPoint? _userMarkerGeoPoint;
  bool _isLoadingUserLocation = false;

  Future<void> _updateUserMarker(GeoPoint newPoint) async {
    if (!mounted || !widget.isMapReady) return;

    if (_userMarkerGeoPoint != null) {
      if ((_userMarkerGeoPoint!.latitude - newPoint.latitude).abs() < 0.00001 &&
          (_userMarkerGeoPoint!.longitude - newPoint.longitude).abs() < 0.00001) {
        return;
      }
      try {
        await widget.mapController.removeMarker(_userMarkerGeoPoint!);
      } catch (_) {}
    }

    _userMarkerGeoPoint = newPoint;
    try {
      await widget.mapController.addMarker(
        newPoint,
        markerIcon: MarkerIcon(
          iconWidget: buildUserLocationMarker(),
        ),
      );
    } catch (_) {}
  }

  Future<void> _getUserLocation({bool centerOnUser = true}) async {
    if (!mounted || !widget.isMapReady) return;

    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      final hasPermission = permission == LocationPermission.always ||
          permission == LocationPermission.whileInUse;
      if (!hasPermission) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('يرجى منح إذن الوصول إلى الموقع لمعرفة موقعك الحالي'),
              duration: Duration(seconds: 2),
            ),
          );
        }
        return;
      }

      setState(() => _isLoadingUserLocation = true);

      Position? position;
      final isServiceEnabled = await Geolocator.isLocationServiceEnabled();
      if (isServiceEnabled) {
        try {
          position = await Geolocator.getCurrentPosition(
            locationSettings: const LocationSettings(
              accuracy: LocationAccuracy.medium,
              timeLimit: Duration(seconds: 5),
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
        final point = GeoPoint(
          latitude: position.latitude,
          longitude: position.longitude,
        );
        await _updateUserMarker(point);

        if (centerOnUser && mounted) {
          await widget.mapController.moveTo(point, animate: true);
        }
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('تعذر تحديد موقعك، يرجى تفعيل خدمة الموقع (GPS)'),
            duration: Duration(seconds: 2),
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('حدث خطأ أثناء تحديد الموقع'),
            duration: Duration(seconds: 2),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoadingUserLocation = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        FloatingActionButton.small(
          heroTag: 'user_location_fab',
          backgroundColor: Colors.white,
          foregroundColor: const Color(0xFF1A73E8),
          onPressed: _isLoadingUserLocation
              ? null
              : () => _getUserLocation(centerOnUser: true),
          tooltip: 'موقعي الحالي',
          child: _isLoadingUserLocation
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Color(0xFF1A73E8),
                  ),
                )
              : const Icon(Icons.my_location_rounded, size: 20),
        ),
        const SizedBox(height: 8),
        if (widget.selectedCity != null)
          FloatingActionButton.small(
            heroTag: 'recenter_city_fab',
            backgroundColor: Colors.white,
            foregroundColor: const Color(0xFF2F2722),
            onPressed: () async {
              if (widget.isMapReady) {
                await widget.mapController.moveTo(
                  widget.selectedCity!.center.toGeoPoint(),
                  animate: true,
                );
              }
            },
            tooltip: 'إعادة التمركز على المدينة',
            child: const Icon(Icons.center_focus_strong_rounded, size: 20),
          ),
      ],
    );
  }
}
