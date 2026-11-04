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
}
