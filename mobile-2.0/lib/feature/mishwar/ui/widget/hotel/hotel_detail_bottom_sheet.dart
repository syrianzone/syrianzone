import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shimmer/shimmer.dart';
import 'package:syrianzone/core/di/get_it.dart';
import 'package:syrianzone/core/network/response/hotel_detail_response.dart';
import 'package:syrianzone/core/util/map_util.dart';
import 'package:syrianzone/core/util/text_util.dart';
import 'package:syrianzone/feature/mishwar/logic/hotel/hotel_detail_cubit.dart';
import 'package:syrianzone/feature/mishwar/logic/hotel/hotel_detail_state.dart';
import 'package:syrianzone/feature/mishwar/repo/mishwar_repo.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/common/mishwar_sheet_constants.dart';
import 'package:url_launcher/url_launcher.dart';

class HotelDetailBottomSheet extends StatefulWidget {
  final int? hotelId;
  final HotelDetailResponse? hotel;
  final String? initialName;

  const HotelDetailBottomSheet({
    super.key,
    this.hotelId,
    this.hotel,
    this.initialName,
  });

  static Future<void> show(
    BuildContext context, {
    int? hotelId,
    HotelDetailResponse? hotel,
    String? initialName,
  }) {
    assert(hotelId != null || hotel != null, 'Either hotelId or hotel must be provided');
    final targetId = hotelId ?? hotel?.id;

    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) {
        return BlocProvider(
          create: (_) {
            if (hotel != null) {
              return HotelDetailCubit(
                getIt<MishwarRepo>(),
                initialState: HotelDetailState.success(hotel),
              );
            }
            final cubit = HotelDetailCubit(getIt<MishwarRepo>());
            if (targetId != null) {
              cubit.loadHotelDetail(targetId);
            }
            return cubit;
          },
          child: HotelDetailBottomSheet(
            hotelId: targetId,
            hotel: hotel,
            initialName: initialName ?? hotel?.displayName,
          ),
        );
      },
    );
  }

  @override
  State<HotelDetailBottomSheet> createState() => _HotelDetailBottomSheetState();
}

class _HotelDetailBottomSheetState extends State<HotelDetailBottomSheet> {
  final PageController _pageController = PageController();
  int _currentImageIndex = 0;

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.hotel != null) {
      return _buildSheetScaffold(
        context,
        title: widget.hotel!.displayName,
        content: (scrollController) =>
            _buildLoadedContent(context, widget.hotel!, scrollController),
      );
    }

    return BlocBuilder<HotelDetailCubit, HotelDetailState>(
      builder: (context, state) {
        final title = state.maybeWhen(
          success: (hotel) => hotel.displayName,
          orElse: () => widget.initialName ?? 'تفاصيل الفندق',
        );

        final contentBuilder = state.when(
          initial: () => (ScrollController sc) => _buildShimmerLoading(sc),
          loading: () => (ScrollController sc) => _buildShimmerLoading(sc),
          success: (hotel) => (ScrollController sc) => _buildLoadedContent(context, hotel, sc),
          error: (message) => (ScrollController _) => _buildErrorView(
                message,
                () {
                  if (widget.hotelId != null) {
                    context.read<HotelDetailCubit>().loadHotelDetail(widget.hotelId!);
                  }
                },
              ),
        );

        return _buildSheetScaffold(
          context,
          title: title,
          content: contentBuilder,
        );
      },
    );
  }

  Widget _buildSheetScaffold(
    BuildContext context, {
    required String title,
    required Widget Function(ScrollController) content,
  }) {
    return DraggableScrollableSheet(
      initialChildSize: MishwarSheetConstants.detailInitialFraction,
      minChildSize: MishwarSheetConstants.detailMinFraction,
      maxChildSize: MishwarSheetConstants.detailMaxFraction,
      builder: (context, scrollController) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: Container(
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            ),
            child: Column(
              children: [
                // Drag handle
                Container(
                  margin: const EdgeInsets.only(top: 10, bottom: 6),
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),

                // Title bar with close button
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF2F2722),
                          ),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, color: Color(0xFF5A4D41)),
                        onPressed: () => Navigator.pop(context),
                        tooltip: 'إغلاق',
                      ),
                    ],
                  ),
                ),

                // Content
                Expanded(
                  child: content(scrollController),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildErrorView(String message, VoidCallback onRetry) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 36),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: const Color(0xFFFDE8E8),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Icon(
                Icons.error_outline_rounded,
                size: 30,
                color: Color(0xFFDC2626),
              ),
            ),
            const SizedBox(height: 14),
            const Text(
              'تعذر تحميل تفاصيل الفندق',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Color(0xFF2F2722),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              message.isNotEmpty ? message : 'يرجى التحقق من اتصالك بالإنترنت والمحاولة مجدداً.',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 13,
                color: Color(0xFF6B5E52),
                height: 1.5,
              ),
            ),
            const SizedBox(height: 18),
            FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF965B0E),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text(
                'إعادة المحاولة',
                style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildShimmerLoading(ScrollController scrollController) {
    return Shimmer.fromColors(
      baseColor: const Color(0xFFEAE3D6),
      highlightColor: const Color(0xFFF7F2E8),
      child: ListView(
        controller: scrollController,
        padding: const EdgeInsets.all(16),
        children: [
          // Main photo shimmer
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: AspectRatio(
              aspectRatio: 16 / 10,
              child: Container(color: Colors.white),
            ),
          ),
          const SizedBox(height: 16),

          // Hotel name shimmer
          Container(
            width: 180,
            height: 22,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(6),
            ),
          ),
          const SizedBox(height: 8),
          Container(
            width: 110,
            height: 14,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(4),
            ),
          ),
          const SizedBox(height: 12),

          // Stars shimmer
          Row(
            children: List.generate(
              5,
              (i) => Container(
                margin: const EdgeInsets.only(left: 4),
                width: 16,
                height: 16,
                decoration: const BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Address shimmer
          Container(
            width: double.infinity,
            height: 14,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(4),
            ),
          ),
          const SizedBox(height: 16),

          // Description shimmer
          Container(
            width: double.infinity,
            height: 12,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(4),
            ),
          ),
          const SizedBox(height: 8),
          Container(
            width: double.infinity,
            height: 12,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(4),
            ),
          ),
          const SizedBox(height: 8),
          FractionallySizedBox(
            alignment: Alignment.centerRight,
            widthFactor: 0.65,
            child: Container(
              height: 12,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Action buttons shimmer
          Row(
            children: [
              Expanded(
                child: Container(
                  height: 44,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Container(
                  height: 44,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildLoadedContent(
    BuildContext context,
    HotelDetailResponse hotel,
    ScrollController scrollController,
  ) {
    final images = hotel.images;
    final hasImages = images.isNotEmpty;

    return ListView(
      controller: scrollController,
      padding: const EdgeInsets.all(16),
      children: [
        // Image Slider
        if (hasImages) ...[
          Stack(
            alignment: Alignment.bottomCenter,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: AspectRatio(
                  aspectRatio: 16 / 10,
                  child: PageView.builder(
                    controller: _pageController,
                    itemCount: images.length,
                    onPageChanged: (index) {
                      setState(() => _currentImageIndex = index);
                    },
                    itemBuilder: (context, index) {
                      return CachedNetworkImage(
                        imageUrl: images[index],
                        fit: BoxFit.cover,
                        placeholder: (_, _) => Shimmer.fromColors(
                          baseColor: Colors.grey.shade300,
                          highlightColor: Colors.grey.shade100,
                          child: Container(color: Colors.white),
                        ),
                        errorWidget: (_, _, _) => Container(
                          color: const Color(0xFFEDE6DD),
                          child: const Icon(Icons.broken_image, size: 40),
                        ),
                      );
                    },
                  ),
                ),
              ),
              // Counter badge (e.g. 1 / 9)
              Positioned(
                bottom: 10,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.65),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Text(
                    '${_currentImageIndex + 1} / ${images.length}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
        ],

        // Hotel Name & Subtitle
        Text(
          hotel.displayName,
          style: const TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            color: Color(0xFF2F2722),
          ),
        ),
        if (hotel.name.isNotEmpty && hotel.name != hotel.nameAr) ...[
          const SizedBox(height: 4),
          Text(
            hotel.name,
            style: const TextStyle(
              fontSize: 14,
              color: Color(0xFF8D7E6E),
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
        const SizedBox(height: 12),

        // Stars
        if (hotel.starRating > 0) ...[
          Row(
            children: [
              Text(
                '${TextUtil.toArabicDigits(hotel.starRating)} نجوم',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF8D7E6E),
                ),
              ),
              const SizedBox(width: 6),
              Row(
                children: List.generate(
                  hotel.starRating.clamp(1, 5),
                  (_) => const Icon(
                    Icons.star,
                    size: 18,
                    color: Color(0xFFF59E0B),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
        ],

        // Address
        if (hotel.displayAddress != null && hotel.displayAddress!.isNotEmpty) ...[
          InkWell(
            onTap: (hotel.lat != null && hotel.lng != null)
                ? () => MapUtil.openMapApp(
                      hotel.lat!,
                      hotel.lng!,
                      label: hotel.displayName,
                    )
                : null,
            child: Row(
              children: [
                const Icon(Icons.location_on_outlined, size: 18, color: Color(0xFF965B0E)),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    hotel.displayAddress!,
                    style: const TextStyle(
                      fontSize: 13,
                      color: Color(0xFF5A4D41),
                      decoration: TextDecoration.underline,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
        ],

        // Amenities
        _buildAmenities(hotel),
        const SizedBox(height: 16),

        // Actions: Phone, Email, Map
        Row(
          children: [
            if (hotel.phone != null && hotel.phone!.isNotEmpty) ...[
              Expanded(
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF965B0E),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    minimumSize: const Size.fromHeight(44),
                  ),
                  onPressed: () async {
                    final uri = Uri.parse('tel:${hotel.phone}');
                    if (await canLaunchUrl(uri)) {
                      await launchUrl(uri);
                    }
                  },
                  icon: const Icon(Icons.phone, size: 18),
                  label: const Text('اتصال', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
              ),
              const SizedBox(width: 8),
            ],
            if (hotel.email != null && hotel.email!.isNotEmpty) ...[
              Expanded(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFFE4D8C8)),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    minimumSize: const Size.fromHeight(44),
                  ),
                  onPressed: () async {
                    final uri = Uri.parse('mailto:${hotel.email}');
                    if (await canLaunchUrl(uri)) {
                      await launchUrl(uri);
                    }
                  },
                  icon: const Icon(Icons.email_outlined, size: 18, color: Color(0xFF965B0E)),
                  label: const Text('بريد', style: TextStyle(color: Color(0xFF2F2722), fontWeight: FontWeight.w600)),
                ),
              ),
              const SizedBox(width: 8),
            ],
            if (hotel.lat != null && hotel.lng != null) ...[
              IconButton(
                style: IconButton.styleFrom(
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                    side: const BorderSide(color: Color(0xFFE4D8C8)),
                  ),
                ),
                onPressed: () => MapUtil.openMapApp(
                  hotel.lat!,
                  hotel.lng!,
                  label: hotel.displayName,
                ),
                icon: const Icon(Icons.map_outlined, color: Color(0xFF965B0E)),
                tooltip: 'فتح في الخريطة',
              ),
            ],
          ],
        ),
        const SizedBox(height: 16),

        // Description
        if (hotel.displayDescription != null && hotel.displayDescription!.isNotEmpty) ...[
          Text(
            hotel.displayDescription!,
            style: const TextStyle(
              fontSize: 14,
              height: 1.6,
              color: Color(0xFF4A3E34),
            ),
          ),
          const SizedBox(height: 20),
        ],

        // External button: HalaSyria
        if (hotel.sourceUrl != null && hotel.sourceUrl!.isNotEmpty) ...[
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: Color(0xFFE4D8C8)),
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            onPressed: () async {
              final uri = Uri.parse(hotel.sourceUrl!);
              if (await canLaunchUrl(uri)) {
                await launchUrl(uri, mode: LaunchMode.externalApplication);
              }
            },
            icon: const Icon(Icons.open_in_new, size: 18, color: Color(0xFF965B0E)),
            label: const Text(
              'بيانات من HalaSyria',
              style: TextStyle(
                color: Color(0xFF2F2722),
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildAmenities(HotelDetailResponse hotel) {
    final list = <Widget>[];

    void addChip(bool? condition, String label, IconData icon) {
      if (condition == true) {
        list.add(
          Chip(
            avatar: Icon(icon, size: 16, color: const Color(0xFF965B0E)),
            label: Text(
              label,
              style: const TextStyle(fontSize: 11, color: Color(0xFF5A4D41)),
            ),
            backgroundColor: const Color(0xFFF9F6F0),
            side: const BorderSide(color: Color(0xFFEFE6DA)),
            padding: const EdgeInsets.symmetric(horizontal: 4),
          ),
        );
      }
    }

    addChip(hotel.hasRestaurant, 'مطعم', Icons.restaurant);
    addChip(hotel.hasSwimmingPool, 'مسبح', Icons.pool);
    addChip(hotel.hasSpa, 'سبا', Icons.spa);
    addChip(hotel.hasFitnessCenter, 'نادي رياضي', Icons.fitness_center);
    addChip(hotel.hasParking, 'موقف سيارات', Icons.local_parking);
    addChip(hotel.hasRoomService, 'خدمة غرف', Icons.room_service);
    addChip(hotel.hasBar, 'مشروبات', Icons.local_bar);
    addChip(hotel.hasAirportShuttle, 'توصيل مطار', Icons.airport_shuttle);

    if (list.isEmpty) return const SizedBox.shrink();

    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: list,
    );
  }
}
