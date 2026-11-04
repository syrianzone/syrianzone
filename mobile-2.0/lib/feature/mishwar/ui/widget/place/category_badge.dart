import 'package:flutter/material.dart';
import 'package:syrianzone/feature/mishwar/constants/mishwar_constants.dart';

class CategoryBadge extends StatelessWidget {
  final String category;

  const CategoryBadge({super.key, required this.category});

  static String getLabel(String category) {
    return MishwarConstants.getCategoryLabel(category);
  }

  @override
  Widget build(BuildContext context) {
    final label = getLabel(category);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: const Color(0xFFF3ECE3),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE4D8C8)),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: Color(0xFF8D7E6E),
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
