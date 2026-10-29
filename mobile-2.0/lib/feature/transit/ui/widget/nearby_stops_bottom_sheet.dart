import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:geolocator/geolocator.dart';
import 'package:syrianzone/core/network/response/nearby_stop_response.dart';
import 'package:syrianzone/core/util/map_util.dart';
import 'package:syrianzone/core/util/text_util.dart';
import 'package:syrianzone/feature/transit/logic/transit_cubit.dart';
import 'package:syrianzone/feature/transit/logic/transit_state.dart';
import 'package:syrianzone/feature/transit/ui/transit_screen.dart';

enum LocationFlowStep {
  checkingPermission,
  serviceDisabled,
  permissionDenied,
  permissionDeniedForever,
  fetchingLocation,
  locationError,
  ready,
}

class NearbyStopsBottomSheet extends StatefulWidget {
  final ValueChanged<NearbyStopResponse>? onStopSelected;

  const NearbyStopsBottomSheet({
    super.key,
    this.onStopSelected,
  });

  static Future<void> show(
    BuildContext context, {
    ValueChanged<NearbyStopResponse>? onStopSelected,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => BlocProvider.value(
        value: context.read<TransitCubit>(),
        child: NearbyStopsBottomSheet(onStopSelected: onStopSelected),
      ),
    );
  }

  @override
  State<NearbyStopsBottomSheet> createState() => _NearbyStopsBottomSheetState();
}

class _NearbyStopsBottomSheetState extends State<NearbyStopsBottomSheet> {
  LocationFlowStep _step = LocationFlowStep.checkingPermission;
  String? _errorMessage;

  static const _primaryColor = Color(0xFFC4862E);
  static const _titleColor = Color(0xFF2F2722);
  static const _metaColor = Color(0xFF8D7E6E);

  @override
  void initState() {
    super.initState();
    _startLocationProcess();
  }

  Future<void> _startLocationProcess() async {
    if (!mounted) return;
    setState(() {
      _step = LocationFlowStep.checkingPermission;
      _errorMessage = null;
    });

    try {
      // 1. Check if location services (GPS) are enabled
      final isServiceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!isServiceEnabled) {
        if (!mounted) return;
        setState(() {
          _step = LocationFlowStep.serviceDisabled;
        });
        return;
      }

      // 2. Check and request location permission
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          if (!mounted) return;
          setState(() {
            _step = LocationFlowStep.permissionDenied;
          });
          return;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        if (!mounted) return;
        setState(() {
          _step = LocationFlowStep.permissionDeniedForever;
        });
        return;
      }

      // 3. Fetch current location
      if (!mounted) return;
      setState(() {
        _step = LocationFlowStep.fetchingLocation;
      });

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 15),
        ),
      );

      if (!mounted) return;
      setState(() {
        _step = LocationFlowStep.ready;
      });

      // 4. Request nearby stops from cubit
      context.read<TransitCubit>().getNearbyStops(
            position.latitude,
            position.longitude,
          );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _step = LocationFlowStep.locationError;
        _errorMessage = 'تعذر تحديد موقعك بدقة، يرجى المحاولة مرة أخرى';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.75,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: [
          BoxShadow(
            color: Color(0x22000000),
            blurRadius: 16,
            offset: Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Drag Handle
            const SizedBox(height: 12),
            Container(
              width: 42,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFDED8D0),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 8),

            // Header Row
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: Row(
                textDirection: TextDirection.rtl,
                children: [
                  const Icon(
                    Icons.near_me_rounded,
                    color: _primaryColor,
                    size: 24,
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'المواقف القريبة',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: _titleColor,
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, color: _metaColor),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: Color(0xFFEBE5DC)),

            // Content Body based on step & state
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: _buildBody(context),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(BuildContext context) {
    switch (_step) {
      case LocationFlowStep.checkingPermission:
      case LocationFlowStep.fetchingLocation:
        return _buildLoading(
          _step == LocationFlowStep.checkingPermission
              ? 'جاري التحقق من إذن الموقع...'
              : 'جاري تحديد موقعك الحالي...',
        );

      case LocationFlowStep.serviceDisabled:
        return _buildStateCard(
          icon: Icons.location_disabled_rounded,
          iconColor: _primaryColor,
          title: 'خدمات الموقع غير مفعلة',
          description:
              'يرجى تفعيل خدمة الموقع (GPS) في هاتفك لنتمكن من البحث عن المواقف القريبة منك.',
          primaryActionText: 'تفعيل الموقع',
          onPrimaryAction: () async {
            await Geolocator.openLocationSettings();
            _startLocationProcess();
          },
          secondaryActionText: 'إعادة المحاولة',
          onSecondaryAction: _startLocationProcess,
        );

      case LocationFlowStep.permissionDenied:
        return _buildStateCard(
          icon: Icons.location_off_rounded,
          iconColor: _primaryColor,
          title: 'إذن الموقع مطلوب',
          description:
              'يحتاج التطبيق إلى إذن الوصول للموقع لعرض أقرب مواقف السيرفيس لموقعك الحالي.',
          primaryActionText: 'منح الإذن',
          onPrimaryAction: _startLocationProcess,
        );

      case LocationFlowStep.permissionDeniedForever:
        return _buildStateCard(
          icon: Icons.settings_suggest_rounded,
          iconColor: _primaryColor,
          title: 'إذن الموقع معطل',
          description:
              'تم رفض إذن الموقع بشكل دائم. يرجى فتح إعدادات التطبيق وتفعيل إذن الموقع للمتابعة.',
          primaryActionText: 'فتح إعدادات التطبيق',
          onPrimaryAction: () async {
            await Geolocator.openAppSettings();
            _startLocationProcess();
          },
          secondaryActionText: 'إعادة المحاولة',
          onSecondaryAction: _startLocationProcess,
        );

      case LocationFlowStep.locationError:
        return _buildStateCard(
          icon: Icons.error_outline_rounded,
          iconColor: Colors.redAccent,
          title: 'حدث خطأ',
          description: _errorMessage ?? 'تعذر تحديد الموقع الحالي.',
          primaryActionText: 'إعادة المحاولة',
          onPrimaryAction: _startLocationProcess,
        );

      case LocationFlowStep.ready:
        return BlocBuilder<TransitCubit, TransitState>(
          builder: (context, state) {
            if (state.nearbyLoading) {
              return _buildLoading('جاري البحث عن المواقف القريبة...');
            }

            if (state.nearbyErrorMessage != null) {
              return _buildStateCard(
                icon: Icons.cloud_off_rounded,
                iconColor: Colors.redAccent,
                title: 'تعذر جلب المواقف',
                description: state.nearbyErrorMessage!,
                primaryActionText: 'إعادة المحاولة',
                onPrimaryAction: _startLocationProcess,
              );
            }

            final stops = state.nearbyStops;
            if (stops != null) {
              if (stops.isEmpty) {
                return _buildEmptyState();
              }
              return _buildStopsList(stops);
            }

            return const SizedBox.shrink();
          },
        );
    }
  }

  Widget _buildLoading(String message) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 40),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(
            width: 38,
            height: 38,
            child: CircularProgressIndicator(
              strokeWidth: 3,
              valueColor: AlwaysStoppedAnimation<Color>(_primaryColor),
            ),
          ),
          const SizedBox(height: 18),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: _titleColor,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              color: Color(0xFFF6F2EB),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.location_off_outlined,
              size: 42,
              color: _metaColor,
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'لا توجد مواقف قريبة من موقعك الحالي',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: _titleColor,
            ),
          ),
          const SizedBox(height: 8),
          Column(
            spacing:8,
            children: [
              const Text(
                '.لم نتمكن من العثور على أي مواقف سرافيس مسجلة في محيط موقعك الحالي',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  color: _metaColor,
                  height: 1.4,
                ),
              ),
                const Text(
                '¯\\_(ツ)_/¯',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  color: _metaColor,
                  height: 1.4,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStateCard({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String description,
    required String primaryActionText,
    required VoidCallback onPrimaryAction,
    String? secondaryActionText,
    VoidCallback? onSecondaryAction,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 52, color: iconColor),
          const SizedBox(height: 16),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 19,
              fontWeight: FontWeight.w800,
              color: _titleColor,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            description,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 15,
              color: _metaColor,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: onPrimaryAction,
              style: FilledButton.styleFrom(
                backgroundColor: _primaryColor,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              child: Text(
                primaryActionText,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          if (secondaryActionText != null && onSecondaryAction != null) ...[
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: onSecondaryAction,
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: Color(0xFFDCD2C4)),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: Text(
                  secondaryActionText,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: _titleColor,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildStopsList(List<NearbyStopResponse> stops) {
    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: stops.length,
      separatorBuilder: (_, _) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final stop = stops[index];
        final routeCount = stop.routes.length;
        final routeCountLabel = routeCount > 0
            ? '${TextUtil.toArabicDigits(routeCount)} خطوط سرفيس'
            : '';

        return Material(
          color: TransitScreen.cardBackground,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: TransitScreen.cardBorder),
          ),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: () {
              if (widget.onStopSelected != null) {
                widget.onStopSelected!(stop);
              } else if (stop.coordinates.length >= 2) {
                final lat = stop.coordinates[1];
                final lng = stop.coordinates[0];
                MapUtil.openMapApp(lat, lng, label: stop.nameAr);
              }
            },
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(
                textDirection: TextDirection.rtl,
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: const BoxDecoration(
                      color: Color(0xFFF7F2EB),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.location_on_outlined,
                      size: 22,
                      color: _primaryColor,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          stop.nameAr,
                          textAlign: TextAlign.right,
                          textDirection: TextDirection.rtl,
                          style: const TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w700,
                            color: _titleColor,
                          ),
                        ),
                        if (routeCountLabel.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            routeCountLabel,
                            textAlign: TextAlign.right,
                            style: const TextStyle(
                              fontSize: 13,
                              color: _metaColor,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEBE5DC),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Text(
                      'موقف',
                      style: TextStyle(
                        color: _titleColor,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
