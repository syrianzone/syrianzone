import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

class TransitStudioCityShimmer extends StatelessWidget {
  const TransitStudioCityShimmer({super.key});

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: const Color(0xFFF1ECE3),
      highlightColor: const Color(0xFFF8F5EF),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: List.generate(8, (index) {
          return Container(
            width: index.isEven ? 80 : 100,
            height: 36,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
            ),
          );
        }),
      ),
    );
  }
}
