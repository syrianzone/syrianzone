import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:syrianzone/core/network/response/guides_response.dart';
import 'package:syrianzone/core/util/text_util.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/guide/guide_level_badge.dart';

class GuideTile extends StatelessWidget {
  final GuideItemResponse guide;
  final VoidCallback? onTap;

  const GuideTile({
    super.key,
    required this.guide,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final pointsText = TextUtil.toArabicDigits(guide.points);
    final approvedText = TextUtil.toArabicDigits(guide.approvedCount);
    final savesText = TextUtil.toArabicDigits(guide.savesTotal);

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Row(
          children: [
            // Rank
            SizedBox(
              width: 24,
              child: Text(
                TextUtil.toArabicDigits(guide.rank),
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: guide.rank <= 3 ? const Color(0xFFB45309) : const Color(0xFF8D7E6E),
                ),
              ),
            ),
            const SizedBox(width: 8),
            // Avatar
            ClipOval(
              child: guide.avatarUrl != null && guide.avatarUrl!.isNotEmpty
                  ? CachedNetworkImage(
                      imageUrl: guide.avatarUrl!,
                      width: 40,
                      height: 40,
                      fit: BoxFit.cover,
                      errorWidget: (context, url, error) => _buildAvatarFallback(),
                    )
                  : _buildAvatarFallback(),
            ),
            const SizedBox(width: 12),
            // User info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          guide.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF2F2722),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      GuideLevelBadge(level: guide.level),
                    ],
                  ),
                  const SizedBox(height: 5),
                  Text(
                    '$pointsText نقطة   •   $approvedText مساهمة   •   $savesText حفظ',
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF8D7E6E),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            // Chevron arrow
            const Icon(
              Icons.chevron_right,
              color: Color(0xFF8D7E6E),
              size: 20,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAvatarFallback() {
    final initials = guide.name.isNotEmpty ? guide.name[0].toUpperCase() : '?';
    return Container(
      width: 40,
      height: 40,
      decoration: const BoxDecoration(
        color: Color(0xFFEDE6DD),
        shape: BoxShape.circle,
      ),
      alignment: Alignment.center,
      child: Text(
        initials,
        style: const TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.bold,
          color: Color(0xFF5A4D41),
        ),
      ),
    );
  }
}
