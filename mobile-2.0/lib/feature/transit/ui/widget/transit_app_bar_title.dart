import 'package:flutter/material.dart';
import 'package:syrianzone/feature/transit/ui/transit_screen.dart';

class TransitAppBarTitle extends StatelessWidget {
  const TransitAppBarTitle({super.key, required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Text(
          title,
          textAlign: TextAlign.center,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w700,
            color: TransitScreen.titleColor,
          ),
        ),
        Text(
          subtitle,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: TransitScreen.metaColor,
          ),
        ),
        const SizedBox(height: 12),
      ],
    );
  }
}
