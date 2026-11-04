import 'package:flutter/material.dart';
import 'package:syrianzone/feature/mishwar/constants/mishwar_constants.dart';

class GuideLevelBadge extends StatelessWidget {
  final int level;
  final bool showLabel;

  const GuideLevelBadge({
    super.key,
    required this.level,
    this.showLabel = true,
  });

  static String rankName(int level) => MishwarConstants.getRankName(level);

  @override
  Widget build(BuildContext context) {
    if (level < 1) return const SizedBox.shrink();

    final label = rankName(level);

    if (level < 3) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: const Color(0xFFEDE6DD),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text(
          showLabel ? '$label $level' : '$level',
          style: const TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.bold,
            color: Color(0xFF6B5846),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF8E6),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFF0D597)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.star,
            size: 11,
            color: Color(0xFFD97706),
          ),
          const SizedBox(width: 2),
          Text(
            '$level',
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.bold,
              color: Color(0xFF92400E),
            ),
          ),
          if (showLabel) ...[
            const SizedBox(width: 4),
            Text(
              label,
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: Color(0xFF92400E),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
