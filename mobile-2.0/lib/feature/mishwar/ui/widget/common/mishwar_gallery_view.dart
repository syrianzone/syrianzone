import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shimmer/shimmer.dart';
import 'package:syrianzone/core/network/response/place_photos_response.dart';
import 'package:syrianzone/feature/mishwar/constants/mishwar_constants.dart';
import 'package:syrianzone/feature/mishwar/logic/mishwar_cubit.dart';
import 'package:syrianzone/feature/mishwar/logic/mishwar_state.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/common/mishwar_error_view.dart';

class MishwarGalleryView extends StatefulWidget {
  final ValueChanged<PlacePhotoEmbeddedPlace> onPlaceTap;

  const MishwarGalleryView({
    super.key,
    required this.onPlaceTap,
  });

  @override
  State<MishwarGalleryView> createState() => _MishwarGalleryViewState();
}

class _MishwarGalleryViewState extends State<MishwarGalleryView> {
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final cubit = context.read<MishwarCubit>();
      if (cubit.state.galleryPhotos.isEmpty &&
          !cubit.state.isLoadingGallery &&
          cubit.state.hasMoreGalleryPhotos) {
        cubit.fetchGalleryPhotos();
      }
    });
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!mounted || !_scrollController.hasClients) return;
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 300) {
      final cubit = context.read<MishwarCubit>();
      if (!cubit.state.isLoadingGallery && cubit.state.hasMoreGalleryPhotos) {
        cubit.fetchGalleryPhotos();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<MishwarCubit, MishwarState>(
      builder: (context, state) {
        if (state.isLoadingGallery && state.galleryPhotos.isEmpty) {
          return _buildShimmerGrid();
        }

        if (state.galleryError != null && state.galleryPhotos.isEmpty) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.only(top: 80),
              child: MishwarErrorView(
                message: state.galleryError!,
                onRetry: () => context.read<MishwarCubit>().fetchGalleryPhotos(refresh: true),
              ),
            ),
          );
        }

        if (state.galleryPhotos.isEmpty) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.only(top: 100, left: 24, right: 24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF3ECE1),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Icon(Icons.photo_library_outlined, size: 32, color: Color(0xFF965B0E)),
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'لا توجد صور متوفرة',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF2F2722),
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'لم يتم إضافة صور للأماكن بعد.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 13, color: Color(0xFF6D6054)),
                  ),
                ],
              ),
            ),
          );
        }

        return Directionality(
          textDirection: TextDirection.rtl,
          child: RefreshIndicator(
            color: const Color(0xFF965B0E),
            onRefresh: () async {
              await context.read<MishwarCubit>().fetchGalleryPhotos(refresh: true);
            },
            child: GridView.builder(
              key: const PageStorageKey<String>('mishwar_gallery_grid_view'),
              controller: _scrollController,
              padding: const EdgeInsets.fromLTRB(14, 68, 14, 24),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
                childAspectRatio: 1.0,
              ),
              itemCount: state.galleryPhotos.length + (state.isLoadingGallery ? 2 : 0),
              itemBuilder: (context, index) {
                if (index >= state.galleryPhotos.length) {
                  return _buildSingleShimmerCard();
                }

                final photo = state.galleryPhotos[index];
                return _buildGalleryCard(photo);
              },
            ),
          ),
        );
      },
    );
  }

  Widget _buildGalleryCard(PlacePhotoFeedItem photo) {
    final imageUrl = photo.thumbUrl ?? photo.displayUrl;
    final hasPhoto = imageUrl != null && imageUrl.isNotEmpty;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => widget.onPlaceTap(photo.place),
        borderRadius: BorderRadius.circular(16),
        child: Container(
          decoration: BoxDecoration(
            color: const Color(0xFFEFE8DD),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE5DDD0)),
            boxShadow: const [
              BoxShadow(
                color: Color(0x14000000),
                blurRadius: 8,
                offset: Offset(0, 3),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: Stack(
              fit: StackFit.expand,
              children: [
                // Photo Image
                if (hasPhoto)
                  Image.network(
                    imageUrl,
                    fit: BoxFit.cover,
                    loadingBuilder: (context, child, loadingProgress) {
                      if (loadingProgress == null) return child;
                      return Shimmer.fromColors(
                        baseColor: const Color(0xFFEAE3D6),
                        highlightColor: const Color(0xFFF7F2E8),
                        child: Container(color: Colors.white),
                      );
                    },
                    errorBuilder: (context, error, stackTrace) => _buildPlaceholder(),
                  )
                else
                  _buildPlaceholder(),

                // Gradient scrim overlay at bottom
                Positioned.fill(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        stops: const [0.45, 1.0],
                        colors: [
                          Colors.transparent,
                          Colors.black.withValues(alpha: 0.75),
                        ],
                      ),
                    ),
                  ),
                ),

                // Text overlay (Place Name & Category)
                Positioned(
                  left: 10,
                  right: 10,
                  bottom: 10,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        photo.place.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          shadows: [
                            Shadow(
                              color: Colors.black54,
                              blurRadius: 4,
                              offset: Offset(0, 1),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 3),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.25),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          MishwarConstants.getCategoryLabel(photo.place.category),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPlaceholder() {
    return Container(
      color: const Color(0xFFF3ECE1),
      child: const Center(
        child: Icon(Icons.photo_outlined, size: 36, color: Color(0xFFC7BBAA)),
      ),
    );
  }

  Widget _buildShimmerGrid() {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 68, 14, 24),
        child: GridView.builder(
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            childAspectRatio: 1.0,
          ),
          itemCount: 6,
          itemBuilder: (context, index) => _buildSingleShimmerCard(),
        ),
      ),
    );
  }

  Widget _buildSingleShimmerCard() {
    return Shimmer.fromColors(
      baseColor: const Color(0xFFEAE3D6),
      highlightColor: const Color(0xFFF7F2E8),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
        ),
      ),
    );
  }
}
