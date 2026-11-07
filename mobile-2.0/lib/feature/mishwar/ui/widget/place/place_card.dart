import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';
import 'package:syrianzone/core/network/response/places_response.dart';
import 'package:syrianzone/core/util/text_util.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/place/category_badge.dart';

class PlaceCard extends StatelessWidget {
  final PlaceResponse place;
  final VoidCallback onTap;

  const PlaceCard({
    super.key,
    required this.place,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Row(
          children: [
            // Thumbnail (on the right in RTL)
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: place.thumbUrl != null && place.thumbUrl!.isNotEmpty
                  ? CachedNetworkImage(
                      imageUrl: place.thumbUrl!,
                      width: 58,
                      height: 58,
                      fit: BoxFit.cover,
                      placeholder: (context, url) => Shimmer.fromColors(
                        baseColor: Colors.grey.shade300,
                        highlightColor: Colors.grey.shade100,
                        child: Container(width: 58, height: 58, color: Colors.white),
                      ),
                      errorWidget: (context, url, error) => _buildPlaceholder(),
                    )
                  : _buildPlaceholder(),
            ),
            const SizedBox(width: 12),
            // Text info (to the left of thumbnail in RTL)
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    place.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF2F2722),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      CategoryBadge(category: place.category),
                      const SizedBox(width: 8),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.bookmark_border,
                            size: 15,
                            color: Color(0xFF8D7E6E),
                          ),
                          const SizedBox(width: 2),
                          Text(
                            TextUtil.toArabicDigits(place.savesCount),
                            style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF8D7E6E),
                            ),
                          ),
                        ],
                      ),
                      if (place.status != null) ...[
                        const SizedBox(width: 8),
                        _buildStatusBadge(place.status!),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlaceholder() {
    return Container(
      width: 58,
      height: 58,
      decoration: BoxDecoration(
        color: const Color(0xFFEDE6DD),
        borderRadius: BorderRadius.circular(10),
      ),
      child: const Icon(
        Icons.photo_outlined,
        color: Color(0xFFA89988),
        size: 24,
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    Color bg;
    Color fg;
    String label;

    switch (status) {
      case 'approved':
        bg = const Color(0xFFE8F5E9);
        fg = const Color(0xFF2E7D32);
        label = 'معتمد';
        break;
      case 'rejected':
        bg = const Color(0xFFFFEBEE);
        fg = const Color(0xFFC62828);
        label = 'مرفوض';
        break;
      case 'pending':
      default:
        bg = const Color(0xFFFFF8E1);
        fg = const Color(0xFFF57F17);
        label = 'قيد المراجعة';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10.5,
          fontWeight: FontWeight.w700,
          color: fg,
        ),
      ),
    );
  }
}
