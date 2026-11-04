import 'package:flutter/material.dart';
import 'package:syrianzone/feature/mishwar/constants/mishwar_constants.dart';

class MishwarRanksBottomSheet extends StatelessWidget {
  const MishwarRanksBottomSheet({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => const MishwarRanksBottomSheet(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.88,
        ),
        decoration: const BoxDecoration(
          color: Color(0xFFFCFBF7),
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          boxShadow: [
            BoxShadow(
              color: Color(0x28000000),
              blurRadius: 16,
              offset: Offset(0, -4),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Drag handle
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(top: 12, bottom: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFFD6C8B4),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),

            // Scrollable Content
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Header Row with Title and Close Button
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'مستويات مشوار',
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF2F2722),
                                ),
                              ),
                              SizedBox(height: 3),
                              Text(
                                'اجمع النقاط بمساهماتك في مشوار وارتقِ في المستويات.',
                                style: TextStyle(
                                  fontSize: 12.5,
                                  color: Color(0xFF6B5E52),
                                ),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                          icon: const Icon(Icons.close_rounded, size: 20, color: Color(0xFF8D7E6E)),
                          onPressed: () => Navigator.pop(context),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // Section 1: How points are calculated
                    _buildPointsRulesCard(),
                    const SizedBox(height: 20),

                    // Section 2: Ranks Header & Table
                    const Text(
                      'الرتب',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF2F2722),
                      ),
                    ),
                    const SizedBox(height: 8),

                    // Table Header
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: const BoxDecoration(
                        color: Color(0xFFF3ECE1),
                        borderRadius: BorderRadius.vertical(top: Radius.circular(10)),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'الرتبة',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF5A4D41),
                            ),
                          ),
                          Text(
                            'النقاط المطلوبة',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF5A4D41),
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Table Rows
                    Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(10)),
                        border: Border.all(color: const Color(0xFFEFE8DD)),
                      ),
                      child: ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: 10,
                        separatorBuilder: (context, index) => const Divider(
                          height: 1,
                          thickness: 0.5,
                          color: Color(0xFFF0EBE1),
                        ),
                        itemBuilder: (context, index) {
                          final level = index + 1;
                          final rankName = MishwarConstants.rankNames[level] ?? 'مرشد';
                          final points = MishwarConstants.levelThresholds[level] ?? 0;
                          return _buildRankRow(level, rankName, points);
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPointsRulesCard() {
    final rules = [
      {'title': 'مكان مقبول', 'points': '15 نقطة', 'icon': Icons.add_location_alt_outlined},
      {'title': 'كل صورة على مكان مقبول', 'points': '5 نقاط', 'icon': Icons.photo_camera_outlined},
      {'title': 'وصف وافٍ (200 حرف أو أكثر)', 'points': '5 نقاط إضافية', 'icon': Icons.article_outlined},
      {'title': 'كل حفظ يحصل عليه مكانك', 'points': 'نقطة واحدة', 'icon': Icons.bookmark_border_rounded},
    ];

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFAF6EE),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFEFE6DA)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(
                Icons.help_outline_rounded,
                size: 17,
                color: Color(0xFF965B0E),
              ),
              SizedBox(width: 6),
              Text(
                'كيف تُحسب النقاط؟',
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF2F2722),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ...rules.map((rule) {
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  Icon(
                    rule['icon'] as IconData,
                    size: 15,
                    color: const Color(0xFF8D7E6E),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      rule['title'] as String,
                      style: const TextStyle(
                        fontSize: 12.5,
                        color: Color(0xFF4A3E34),
                      ),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF3ECE1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      rule['points'] as String,
                      style: const TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF965B0E),
                      ),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildRankRow(int level, String rankName, int points) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Rank Badge + Name
          _buildLevelBadge(level, rankName),

          // Required Points
          Text(
            _formatPoints(points),
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: Color(0xFF2F2722),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLevelBadge(int level, String rankName) {
    // Levels 1-2: Neutral gray
    if (level < 3) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: const Color(0xFFEDE6DD),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text(
          '$rankName $level',
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.bold,
            color: Color(0xFF6B5846),
          ),
        ),
      );
    }

    // Levels 3-7: Warm Gold / Amber
    if (level <= 7) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: const Color(0xFFFFF8E6),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFFF0D597)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              level == 3 ? Icons.explore_outlined : Icons.star_rounded,
              size: 13,
              color: const Color(0xFFD97706),
            ),
            const SizedBox(width: 4),
            Text(
              '$rankName $level',
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: Color(0xFF92400E),
              ),
            ),
          ],
        ),
      );
    }

    // Levels 8-10: Tourism Leaders (Rose / Magenta)
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: const Color(0xFFFDF2F8),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFFBCFE8)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            level == 9 ? Icons.location_on_outlined : Icons.auto_awesome_rounded,
            size: 13,
            color: const Color(0xFFDB2777),
          ),
          const SizedBox(width: 4),
          Text(
            '$rankName $level',
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.bold,
              color: Color(0xFF9D174D),
            ),
          ),
        ],
      ),
    );
  }

  String _formatPoints(int points) {
    if (points >= 1000) {
      final str = points.toString();
      final buffer = StringBuffer();
      int count = 0;
      for (int i = str.length - 1; i >= 0; i--) {
        buffer.write(str[i]);
        count++;
        if (count % 3 == 0 && i > 0) {
          buffer.write(',');
        }
      }
      return buffer.toString().split('').reversed.join();
    }
    return points.toString();
  }
}
