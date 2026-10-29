import 'package:flutter/material.dart';
import 'package:syrianzone/core/network/response/map_data_response.dart';
import 'package:syrianzone/core/util/map_util.dart';
import 'package:syrianzone/core/util/text_util.dart';
import 'package:syrianzone/feature/transit/ui/transit_screen.dart';
import 'package:syrianzone/feature/transit/ui/widget/route_meta_card.dart';
import 'package:syrianzone/feature/transit/ui/widget/stop_tile.dart';

class RouteStopsDetails extends StatelessWidget {
  const RouteStopsDetails({super.key, 
    required this.route,
    required this.stops,
    required this.onBack,
  });

  final MapRouteProperties route;
  final List<MapStopFeature> stops;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final fareValue = route.priceNew ?? 0;
    final fareLabel = '${TextUtil.toArabicDigits(fareValue)} ل.س';

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
      child: ListView(
        children: [
          Row(
            children: [
              IconButton(
                onPressed: onBack,
                icon: const Icon(Icons.arrow_back_ios_new_rounded),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  route.nameAr,
                  textAlign: TextAlign.right,
                  
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: TransitScreen.titleColor,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: RouteMetaCard(
                  title: 'المواقف',
                  value: '${TextUtil.toArabicDigits(stops.length)} موقف',
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: RouteMetaCard(title: 'سعر الركوب', value: fareLabel),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Text(
                TextUtil.toArabicDigits(stops.length),
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w500,
                  color: TransitScreen.metaColor,
                ),
              ),
              const Spacer(),
              const Text(
                'المواقف',
                style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w500,
                  color: TransitScreen.metaColor,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (stops.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 18),
              child: Center(child: Text('لا توجد مواقف لهذا الخط')),
            )
          else
            ...List.generate(stops.length, (index) {
              final stop = stops[index];
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: StopTile(
                  index: index,
                  stopName: stop.properties.nameAr,
                  onTap: () {
                    final coords = stop.geometry.coordinates;
                    if (coords.length >= 2) {
                      final lat = coords[1];
                      final lng = coords[0];
                      MapUtil.openMapApp(lat, lng, label: stop.properties.nameAr);
                    }
                  },
                ),
              );
            }),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}
