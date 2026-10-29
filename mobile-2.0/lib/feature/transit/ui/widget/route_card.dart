import 'package:flutter/material.dart';
import 'package:syrianzone/core/constants/route_palette.dart';
import 'package:syrianzone/core/extensions/locale_extensions.dart';
import 'package:syrianzone/core/network/response/map_data_response.dart';
import 'package:syrianzone/core/util/color_util.dart';
import 'package:syrianzone/core/util/text_util.dart';
import 'package:syrianzone/feature/transit/ui/transit_screen.dart';

class RouteCard extends StatelessWidget {
  const RouteCard({super.key, 
    required this.route,
    required this.stopsCount,
    required this.onTap,
  });

  final MapRouteProperties route;
  final int stopsCount;
  final VoidCallback onTap;

 

  @override
  Widget build(BuildContext context) {
    final stripeColor = ColorUtil.hexToColor(
      RoutePalette.colorForIndexOrDefault(route.colorIndex),
    );

    final fareValue = route.priceNew ?? 0;
    final fareLabel = '${TextUtil.toArabicDigits(fareValue)} ل.س';

    return Material(
      color: TransitScreen.cardBackground,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
        side: const BorderSide(color: TransitScreen.cardBorder),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        splashColor: const Color(0x22000000),
        highlightColor: const Color(0x11000000),
        child: Stack(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 18, 22, 16),
              child: Column(
                children: [
                  Align(
                    alignment: Alignment.centerRight,
                    child: Text(
                      route.nameAr,
                      textAlign: TextAlign.right,
                      style: const TextStyle(
                        color: TransitScreen.titleColor,
                        fontWeight: FontWeight.w700,
                        fontSize: 18,
                        height: 1.25,
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    textDirection: TextDirection.rtl,
                    children: [
                      const Icon(
                        Icons.location_on_outlined,
                        size: 20,
                        color: TransitScreen.metaColor,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        context.appLocalizations.stops(stopsCount, TextUtil.toArabicDigits(stopsCount)),
                        // _stopsCountLabel(stopsCount),
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                          color: TransitScreen.metaColor,
                        ),
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 8),
                        child: Text(
                          '•',
                          style: TextStyle(
                            fontSize: 16,
                            color: Color(0xFFC8BEB2),
                          ),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: TransitScreen.priceBg,
                          borderRadius: BorderRadius.circular(18),
                        ),
                        child: Text(
                          fareLabel,
                          style: const TextStyle(
                            color: TransitScreen.priceText,
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Positioned(
              top: 0,
              bottom: 0,
              right: 0,
              child: Container(
                width: 8,
                decoration: BoxDecoration(
                  color: stripeColor,
                  borderRadius: const BorderRadius.only(
                    topRight: Radius.circular(24),
                    bottomRight: Radius.circular(24),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
