import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';
import 'package:syrianzone/core/network/response/hotel_response.dart';
import 'package:syrianzone/core/util/text_util.dart';

class HotelCard extends StatelessWidget {
  final HotelResponse hotel;
  final VoidCallback onTap;

  const HotelCard({
    super.key,
    required this.hotel,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final cityName = (hotel.cityAr != null && hotel.cityAr!.isNotEmpty)
        ? hotel.cityAr!
        : (hotel.city ?? '');

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
              child: hotel.thumbUrl != null && hotel.thumbUrl!.isNotEmpty
                  ? CachedNetworkImage(
                      imageUrl: hotel.thumbUrl!,
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
            // Info (to the left of thumbnail in RTL)
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    hotel.displayName,
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
                      if (cityName.isNotEmpty) ...[
                        Text(
                          cityName,
                          style: const TextStyle(
                            fontSize: 12,
                            color: Color(0xFF8D7E6E),
                          ),
                        ),
                        const SizedBox(width: 8),
                      ],
                      if (hotel.starRating > 0) ...[
                        const Icon(
                          Icons.star,
                          size: 14,
                          color: Color(0xFFD97706),
                        ),
                        const SizedBox(width: 2),
                        Text(
                          TextUtil.toArabicDigits(hotel.starRating),
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF8D7E6E),
                          ),
                        ),
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
        Icons.hotel_outlined,
        color: Color(0xFFA89988),
        size: 24,
      ),
    );
  }
}
