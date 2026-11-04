import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shimmer/shimmer.dart';
import 'package:syrianzone/core/di/get_it.dart';
import 'package:syrianzone/core/network/response/place_detail_response.dart';
import 'package:syrianzone/core/util/map_util.dart';
import 'package:syrianzone/feature/mishwar/logic/place/place_detail_cubit.dart';
import 'package:syrianzone/feature/mishwar/logic/place/place_detail_state.dart';
import 'package:syrianzone/feature/mishwar/repo/mishwar_repo.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/common/mishwar_sheet_constants.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/guide/guide_level_badge.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/place/category_badge.dart';

class PlaceDetailBottomSheet extends StatefulWidget {
  final int? placeId;
  final PlaceDetailResponse? place;
  final String? initialName;
  final String? initialCategory;

  const PlaceDetailBottomSheet({
    super.key,
    this.placeId,
    this.place,
    this.initialName,
    this.initialCategory,
  });

  static Future<void> show(
    BuildContext context, {
    int? placeId,
    PlaceDetailResponse? place,
    String? initialName,
    String? initialCategory,
  }) {
    assert(placeId != null || place != null, 'Either placeId or place must be provided');
    final targetId = placeId ?? place?.id;

    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) {
        return BlocProvider(
          create: (_) {
            if (place != null) {
              return PlaceDetailCubit(
                getIt<MishwarRepo>(),
                initialState: PlaceDetailState.success(place),
              );
            }
            final cubit = PlaceDetailCubit(getIt<MishwarRepo>());
            if (targetId != null) {
              cubit.loadPlaceDetail(targetId);
            }
            return cubit;
          },
          child: PlaceDetailBottomSheet(
            placeId: targetId,
            place: place,
            initialName: initialName ?? place?.name,
            initialCategory: initialCategory ?? place?.category,
          ),
        );
      },
    );
  }

  @override
  State<PlaceDetailBottomSheet> createState() => _PlaceDetailBottomSheetState();
}

class _PlaceDetailBottomSheetState extends State<PlaceDetailBottomSheet> {
  final GlobalKey<ScaffoldMessengerState> _scaffoldMessengerKey = GlobalKey<ScaffoldMessengerState>();
  int _selectedPhotoIndex = 0;

  @override
  Widget build(BuildContext context) {
    if (widget.place != null) {
      return _buildSheetScaffold(
        context,
        content: (scrollController) =>
            _buildLoadedContent(context, widget.place!, scrollController),
        title: widget.place!.name,
      );
    }

    return BlocBuilder<PlaceDetailCubit, PlaceDetailState>(
      builder: (context, state) {
        final title = state.maybeWhen(
          success: (place) => place.name,
          orElse: () => widget.initialName ?? 'تفاصيل المكان',
        );

        final contentBuilder = state.when(
          initial: () => (ScrollController sc) => _buildShimmerLoading(sc),
          loading: () => (ScrollController sc) => _buildShimmerLoading(sc),
          success: (place) => (ScrollController sc) => _buildLoadedContent(context, place, sc),
          error: (message) => (ScrollController _) => _buildErrorView(
                message,
                () {
                  if (widget.placeId != null) {
                    context.read<PlaceDetailCubit>().loadPlaceDetail(widget.placeId!);
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
        return ScaffoldMessenger(
          key: _scaffoldMessengerKey,
          child: Scaffold(
            backgroundColor: Colors.transparent,
            body: Directionality(
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

                    // Top title bar with close icon
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

                    // Main Content
                    Expanded(
                      child: content(scrollController),
                    ),
                  ],
                ),
              ),
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
              'تعذر تحميل تفاصيل المكان',
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
              aspectRatio: 16 / 9,
              child: Container(color: Colors.white),
            ),
          ),
          const SizedBox(height: 10),

          // Photo thumbnails row shimmer
          Row(
            children: List.generate(
              4,
              (i) => Container(
                margin: const EdgeInsets.only(left: 8),
                width: 50,
                height: 50,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Title & Badge shimmer
          Row(
            children: [
              Container(
                width: 140,
                height: 20,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(6),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                width: 60,
                height: 20,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(6),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Description lines shimmer
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
            widthFactor: 0.6,
            child: Container(
              height: 12,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Author card shimmer
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: const BoxDecoration(
                    color: Color(0xFFDDD5C8),
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 10),
                Container(
                  width: 90,
                  height: 14,
                  decoration: BoxDecoration(
                    color: const Color(0xFFDDD5C8),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Action buttons shimmer
          Row(
            children: [
              Expanded(
                child: Container(
                  height: 46,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                width: 60,
                height: 46,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(10),
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
    PlaceDetailResponse place,
    ScrollController scrollController,
  ) {
    final photos = place.photos;
    final hasPhotos = photos.isNotEmpty;

    return ListView(
      controller: scrollController,
      padding: const EdgeInsets.all(16),
      children: [
        // Main photo
        if (hasPhotos) ...[
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: AspectRatio(
              aspectRatio: 16 / 9,
              child: CachedNetworkImage(
                imageUrl: photos[_selectedPhotoIndex.clamp(0, photos.length - 1)].displayUrl,
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
              ),
            ),
          ),
          if (photos.length > 1) ...[
            const SizedBox(height: 8),
            SizedBox(
              height: 54,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: photos.length,
                separatorBuilder: (context, index) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final isSelected = index == _selectedPhotoIndex;
                  return GestureDetector(
                    onTap: () => setState(() => _selectedPhotoIndex = index),
                    child: Container(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: isSelected ? const Color(0xFF965B0E) : Colors.transparent,
                          width: 2,
                        ),
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(6),
                        child: CachedNetworkImage(
                          imageUrl: photos[index].thumbUrl ?? photos[index].displayUrl,
                          width: 50,
                          height: 50,
                          fit: BoxFit.cover,
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
          const SizedBox(height: 16),
        ],

        // Category badge & Title
        Row(
          children: [
            Expanded(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Text(
                    place.name,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF2F2722),
                    ),
                  ),
                  const SizedBox(width: 8),
                  CategoryBadge(category: place.category),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),

        // Description
        if (place.description != null && place.description!.isNotEmpty) ...[
          Text(
            place.description!,
            style: const TextStyle(
              fontSize: 14,
              height: 1.6,
              color: Color(0xFF4A3E34),
            ),
          ),
          const SizedBox(height: 16),
        ],

        // Author info
        if (place.user != null) ...[
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xFFF9F6F0),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFEFE6DA)),
            ),
            child: Row(
              children: [
                ClipOval(
                  child: place.user!.avatarUrl != null && place.user!.avatarUrl!.isNotEmpty
                      ? CachedNetworkImage(
                          imageUrl: place.user!.avatarUrl!,
                          width: 32,
                          height: 32,
                          fit: BoxFit.cover,
                          errorWidget: (_, _, _) => _buildUserFallback(place.user!.name),
                        )
                      : _buildUserFallback(place.user!.name),
                ),
                const SizedBox(width: 10),
                Text(
                  place.user!.name,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF2F2722),
                  ),
                ),
                const SizedBox(width: 8),
                if (place.user!.level != null)
                  GuideLevelBadge(level: place.user!.level!),
              ],
            ),
          ),
          const SizedBox(height: 16),
        ],

        // Coordinates & Copy
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: const Color(0xFFF3ECE3),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Directionality(
                textDirection: TextDirection.ltr,
                child: Text(
                  '${place.lat.toStringAsFixed(5)}, ${place.lng.toStringAsFixed(5)}',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF5A4D41),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              InkWell(
                onTap: () {
                  Clipboard.setData(ClipboardData(text: '${place.lat}, ${place.lng}'));
                  _scaffoldMessengerKey.currentState?.hideCurrentSnackBar();
                  _scaffoldMessengerKey.currentState?.showSnackBar(
                    SnackBar(
                      behavior: SnackBarBehavior.floating,
                      backgroundColor: const Color(0xFF2F2722),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      content: const Directionality(
                        textDirection: TextDirection.rtl,
                        child: Text(
                          'تم نسخ الإحداثيات',
                          style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                        ),
                      ),
                      duration: const Duration(seconds: 2),
                    ),
                  );
                },
                borderRadius: BorderRadius.circular(4),
                child: const Padding(
                  padding: EdgeInsets.all(4.0),
                  child: Icon(
                    Icons.copy,
                    size: 16,
                    color: Color(0xFF965B0E),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Actions: Open in Google Maps, Save, etc.
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: Color(0xFFE4D8C8)),
                  minimumSize: const Size.fromHeight(46),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                onPressed: () async {
                  await MapUtil.openMapApp(
                    place.lat,
                    place.lng,
                    label: place.name,
                  );
                },
                icon: const Icon(Icons.map_outlined, color: Color(0xFF965B0E), size: 18),
                label: const Text(
                  'افتح في خرائط جوجل',
                  style: TextStyle(
                    color: Color(0xFF2F2722),
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Color(0xFFE4D8C8)),
                minimumSize: const Size(0, 46),
                padding: const EdgeInsets.symmetric(horizontal: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              onPressed: () {
                _scaffoldMessengerKey.currentState?.hideCurrentSnackBar();
                _scaffoldMessengerKey.currentState?.showSnackBar(
                  SnackBar(
                    behavior: SnackBarBehavior.floating,
                    backgroundColor: const Color(0xFF2F2722),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    content: const Directionality(
                      textDirection: TextDirection.rtl,
                      child: Text(
                        'يتطلب حفظ الأماكن تسجيل الدخول',
                        style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                      ),
                    ),
                    duration: const Duration(seconds: 2),
                  ),
                );
              },
              icon: const Icon(Icons.bookmark_border, size: 18, color: Color(0xFF8D7E6E)),
              label: Text(
                place.savesCount.toString(),
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF8D7E6E),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildUserFallback(String name) {
    return Container(
      width: 32,
      height: 32,
      color: const Color(0xFFEDE6DD),
      alignment: Alignment.center,
      child: Text(
        name.isNotEmpty ? name[0] : '?',
        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
      ),
    );
  }
}
