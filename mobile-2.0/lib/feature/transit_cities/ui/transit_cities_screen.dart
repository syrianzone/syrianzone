import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:syrianzone/core/extensions/color_scheme_extensions.dart';
import 'package:syrianzone/core/extensions/navigation_extensions.dart';
import 'package:syrianzone/core/routing/routes.dart';
import 'package:syrianzone/core/util/text_util.dart';
import 'package:syrianzone/core/widget/bump_animation.dart';
import 'package:syrianzone/feature/transit_cities/logic/transit_cities_cubit.dart';
import 'package:syrianzone/feature/transit_cities/logic/transit_cities_state.dart';
import 'package:syrianzone/feature/transit_cities/ui/transit_cities_grid_bloc.dart';

class TransitCitiesScreen extends StatelessWidget {
  const TransitCitiesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(centerTitle: true, title: BumpyBusAnimation()),
      body: SafeArea(
        child: SingleChildScrollView(
          child: Column(
            children: [
              Container(
                color: context.colorScheme.primary,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(8, 16, 8, 16),
                  child: Column(
                    children: [
                      Text(
                        "ترانزيت سوريا",
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        "دليل وخرائط تفاعلية لشبكات وخطوط المواصلات العامة والسرافيس في المدن السورية — يجمعها المجتمع ويحدّثها، ومتاحة للجميع مجاناً.",
                        style: TextStyle(color: Colors.white, fontSize: 16),
                        textAlign: TextAlign.right,
                      ),

                      const SizedBox(height: 16),

                      const _TransitCitiesStats(),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(8.0),
                child: TransitCitiesGridBloc(),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16.0, 4.0, 16.0, 24.0),
                child: _ContributeRouteButton(
                  onTap: () {
                    context.pushNamed(Routes.transitStudio);
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ContributeRouteButton extends StatelessWidget {
  const _ContributeRouteButton({this.onTap});

  final VoidCallback? onTap;

  static const _cardBackground = Color(0xFFFCFAF3);
  static const _cardBorder = Color(0xFFE4D8C8);
  static const _iconBadgeBackground = Color(0xFFF1EDE6);
  static const _iconColor = Color(0xFFAB6D17);
  static const _titleColor = Color(0xFF261F17);
  static const _subtitleColor = Color(0xFF8C7B69);
  static const _arrowColor = Color(0xFF857360);

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: CustomPaint(
        foregroundPainter: const _DashedBorderPainter(
          color: _cardBorder,
          borderRadius: 16,
          strokeWidth: 1.2,
          dashLength: 5.0,
          dashGap: 3.5,
        ),
        child: Material(
          color: _cardBackground,
          borderRadius: BorderRadius.circular(16),
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: onTap ?? () {},
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: _iconBadgeBackground,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    alignment: Alignment.center,
                    child: const Icon(
                      Icons.add,
                      color: _iconColor,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'ساهم بإضافة خط',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: _titleColor,
                          ),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'تعرف على مسار سيرفيس غير مسجّل؟ ارسمه على الخريطة',
                          style: TextStyle(
                            fontSize: 12,
                            color: _subtitleColor,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Icon(
                    Icons.arrow_back,
                    color: _arrowColor,
                    size: 18,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _DashedBorderPainter extends CustomPainter {
  final Color color;
  final double strokeWidth;
  final double dashLength;
  final double dashGap;
  final double borderRadius;

  const _DashedBorderPainter({
    required this.color,
    this.strokeWidth = 1.2,
    this.dashLength = 5.0,
    this.dashGap = 3.5,
    this.borderRadius = 16.0,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke;

    final halfStroke = strokeWidth / 2;
    final rrect = RRect.fromRectAndRadius(
      Rect.fromLTWH(
        halfStroke,
        halfStroke,
        size.width - strokeWidth,
        size.height - strokeWidth,
      ),
      Radius.circular(borderRadius),
    );

    final path = Path()..addRRect(rrect);
    final dashedPath = Path();

    for (final metric in path.computeMetrics()) {
      double distance = 0.0;
      while (distance < metric.length) {
        final length = math.min(dashLength, metric.length - distance);
        dashedPath.addPath(
          metric.extractPath(distance, distance + length),
          Offset.zero,
        );
        distance += dashLength + dashGap;
      }
    }

    canvas.drawPath(dashedPath, paint);
  }

  @override
  bool shouldRepaint(covariant _DashedBorderPainter oldDelegate) {
    return oldDelegate.color != color ||
        oldDelegate.strokeWidth != strokeWidth ||
        oldDelegate.dashLength != dashLength ||
        oldDelegate.dashGap != dashGap ||
        oldDelegate.borderRadius != borderRadius;
  }
}


class _TransitCitiesStats extends StatelessWidget {
  const _TransitCitiesStats();

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<TransitCitiesCubit>();

    return BlocBuilder<TransitCitiesCubit, TransitCitiesState>(
      builder: (context, state) {
        return state.maybeWhen(
          success: (_) {
            final cities = cubit.allCities
                .where((city) => city.routeCount > 0)
                .toList();
            final routeCount = cities.fold<int>(
              0,
              (total, city) => total + city.routeCount,
            );

            return Row(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _TransitCitiesStatItem(
                  label: 'مدن جاهزة',
                  value: TextUtil.toArabicDigits(cities.length),
                ),
                const VerticalDivider(),
                _TransitCitiesStatItem(
                  label: 'خط سيرفيس',
                  value: TextUtil.toArabicDigits(routeCount),
                ),
              ],
            );
          },
          orElse: () => const SizedBox.shrink(),
        );
      },
    );
  }
}

class _TransitCitiesStatItem extends StatelessWidget {
  const _TransitCitiesStatItem({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      spacing: 4,
      children: [
        Text(label, style: const TextStyle(color: Colors.grey, fontSize: 14)),
        Text(value, style: const TextStyle(color: Colors.white, fontSize: 16)),
      ],
    );
  }
}
