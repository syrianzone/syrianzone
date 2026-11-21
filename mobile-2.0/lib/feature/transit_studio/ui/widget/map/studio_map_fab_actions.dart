import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:syrianzone/core/data/model/lng_lat.dart';
import 'package:syrianzone/core/network/response/city_response.dart';

class StudioMapFabActions extends StatefulWidget {
  final MapController mapController;
  final CityResponse? selectedCity;
  final ValueChanged<LatLng>? onUserLocationChanged;

  const StudioMapFabActions({
    super.key,
    required this.mapController,
    required this.selectedCity,
    this.onUserLocationChanged,
  });

  @override
  State<StudioMapFabActions> createState() => _StudioMapFabActionsState();
}

class _StudioMapFabActionsState extends State<StudioMapFabActions> {
  bool _isLoadingUserLocation = false;

  Future<void> _getUserLocation({bool centerOnUser = true}) async {
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
        final point = LatLng(position.latitude, position.longitude);
        widget.onUserLocationChanged?.call(point);

        if (centerOnUser && mounted) {
          widget.mapController.move(point, 16.0);
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
            onPressed: () {
              widget.mapController.move(
                widget.selectedCity!.center.toLatLng(),
                widget.selectedCity!.zoom,
              );
            },
            tooltip: 'إعادة التمركز على المدينة',
            child: const Icon(Icons.center_focus_strong_rounded, size: 20),
          ),
      ],
    );
  }
}
