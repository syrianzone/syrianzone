import 'package:flutter/material.dart';
import 'package:syrianzone/feature/transit/ui/transit_screen.dart';

class RouteMetaCard extends StatelessWidget {
  const RouteMetaCard({super.key, required this.title, required this.value});

  final String title;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: TransitScreen.cardBorder),
        boxShadow: [
          BoxShadow(
            color: const Color(0x1A000000),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(
            title,
            textAlign: TextAlign.right,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: TransitScreen.metaColor,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            textAlign: TextAlign.right,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: TransitScreen.titleColor,
            ),
          ),
        ],
      ),
    );
  }
}
