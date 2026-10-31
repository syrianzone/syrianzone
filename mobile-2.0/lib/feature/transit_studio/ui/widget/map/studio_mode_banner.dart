import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:syrianzone/feature/transit_studio/data/model/studio_tool_mode.dart';
import '../../../logic/transit_studio_cubit.dart';
import '../../../logic/transit_studio_state.dart';

class StudioModeBanner extends StatefulWidget {
  final TransitStudioState state;

  const StudioModeBanner({super.key, required this.state});

  @override
  State<StudioModeBanner> createState() => _StudioModeBannerState();
}

class _StudioModeBannerState extends State<StudioModeBanner>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseController;
  late final Animation<double> _pulseScaleAnimation;
  late final Animation<double> _pulseOpacityAnimation;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    )..repeat(reverse: true);

    _pulseScaleAnimation = Tween<double>(begin: 0.9, end: 1.25).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    _pulseOpacityAnimation = Tween<double>(begin: 0.45, end: 1.0).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.state;
    String message = '';
    Color indicatorColor = const Color(0xFFAB6D17);
    Widget? leadingIcon;

    if (state.activeTool == StudioToolMode.drawRoad) {
      message = 'وضع رسم المسار: انقر على الخريطة لإضافة نقاط';
      indicatorColor = const Color(0xFFAB6D17);
    } else if (state.activeTool == StudioToolMode.movePoint) {
      final pointNumber = (state.selectedPointIndex ?? 0) + 1;
      message = 'نقل النقطة $pointNumber: انقر على موقع جديد لنقلها';
      indicatorColor = const Color(0xFFE65100);
      leadingIcon = const Padding(
        padding: EdgeInsets.only(left: 6),
        child: Icon(Icons.pan_tool_rounded, color: Colors.white, size: 16),
      );
    } else if (state.activeTool == StudioToolMode.addStops) {
      message = 'وضع المحطات: انقر على الخريطة لإضافة محطة جديدة';
      indicatorColor = const Color(0xFF2E7D32);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF2F2722).withValues(alpha: 0.94),
        borderRadius: BorderRadius.circular(24),
        boxShadow: const [
          BoxShadow(
            color: Color(0x33000000),
            blurRadius: 8,
            offset: Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        children: [
          AnimatedBuilder(
            animation: _pulseController,
            builder: (context, child) {
              return Transform.scale(
                scale: _pulseScaleAnimation.value,
                child: Opacity(
                  opacity: _pulseOpacityAnimation.value,
                  child: Container(
                    width: 12,
                    height: 12,
                    decoration: BoxDecoration(
                      color: indicatorColor,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: indicatorColor.withValues(alpha: 0.8),
                          blurRadius: 8,
                          spreadRadius: 2,
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
          const SizedBox(width: 8),
          ?leadingIcon,
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: () {
              final cubit = context.read<TransitStudioCubit>();
              if (state.activeTool == StudioToolMode.movePoint) {
                cubit.cancelMovePoint();
              } else {
                cubit.setToolMode(StudioToolMode.none);
              }
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                state.activeTool == StudioToolMode.movePoint
                    ? 'إلغاء النقل'
                    : 'إنهاء',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 11.5,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
