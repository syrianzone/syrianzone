import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';
import 'package:syrianzone/core/constants/route_palette.dart';
import 'package:syrianzone/core/util/color_util.dart';
import 'package:syrianzone/feature/transit/ui/transit_screen.dart';

class TransitLoadingList extends StatelessWidget {
  const TransitLoadingList({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
      itemCount: 5,
      separatorBuilder: (_, __) => const SizedBox(height: 14),
      itemBuilder: (context, index) {
        final stripeColor = ColorUtil.hexToColor(
          RoutePalette.colorForIndexOrDefault(index),
        );
        return ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: Stack(
            children: [
              Container(
                decoration: BoxDecoration(
                  color: TransitScreen.cardBackground,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: TransitScreen.cardBorder),
                ),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(18, 18, 22, 16),
                  child: Shimmer.fromColors(
                    baseColor: const Color(0xFFF1ECE3),
                    highlightColor: const Color(0xFFF8F5EF),
                    child: Column(
                      children: [
                        Container(
                          height: 52,
                          width: double.infinity,
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        const SizedBox(height: 10),
                        Align(
                          alignment: Alignment.centerRight,
                          child: Container(
                            height: 22,
                            width: 160,
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(20),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
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
        );
      },
    );
  }
}
