import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shimmer/shimmer.dart';
import 'package:syrianzone/core/network/response/places_response.dart';
import 'package:syrianzone/feature/mishwar/constants/mishwar_constants.dart';
import 'package:syrianzone/feature/mishwar/logic/mishwar_cubit.dart';
import 'package:syrianzone/feature/mishwar/logic/mishwar_state.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/common/mishwar_error_view.dart';

class MishwarGalleryView extends StatefulWidget {
  final ValueChanged<PlaceResponse> onPlaceTap;

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
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 300) {
      final cubit = context.read<MishwarCubit>();
      if (!cubit.state.isLoadingPlaces && cubit.state.hasMorePlaces) {
        cubit.fetchPlaces();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<MishwarCubit, MishwarState>(
      builder: (context, state) {
        if (state.isLoadingPlaces && state.places.isEmpty) {
          return _buildShimmerGrid();
        }

        if (state.placesError != null && state.places.isEmpty) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.only(top: 80),
              child: MishwarErrorView(
                message: state.placesError!,
                onRetry: () => context.read<MishwarCubit>().fetchPlaces(refresh: true),
              ),
            ),
          );
        }

        if (state.places.isEmpty) {
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
                    'لا توجد أماكن متوفرة',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF2F2722),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    state.selectedCategory != null
                        ? 'لا توجد أماكن في تصنيف "${MishwarConstants.getCategoryLabel(state.selectedCategory)}"'
                        : 'لم يتم إضافة أماكن بعد.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 13, color: Color(0xFF6D6054)),
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
              await context.read<MishwarCubit>().fetchPlaces(refresh: true);
            },
            child: GridView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.fromLTRB(14, 68, 14, 24),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
                childAspectRatio: 1.0,
              ),
              itemCount: state.places.length + (state.isLoadingPlaces ? 2 : 0),
              itemBuilder: (context, index) {
                if (index >= state.places.length) {
                  return _buildSingleShimmerCard();
                }

                final place = state.places[index];
                return _buildGalleryCard(place);
              },
            ),
          ),
        );
      },
    );
  }

  Widget _buildGalleryCard(PlaceResponse place) {
    final hasPhoto = place.thumbUrl != null && place.thumbUrl!.isNotEmpty;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => widget.onPlaceTap(place),
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
                // Place Image
                if (hasPhoto)
                  Image.network(
                    place.thumbUrl!,
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

                // Text overlay (Title & Category)
                Positioned(
                  left: 10,
                  right: 10,
                  bottom: 10,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        place.name,
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
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Flexible(
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.25),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                MishwarConstants.getCategoryLabel(place.category),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ),
                          if (place.savesCount > 0)
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.bookmark, size: 12, color: Color(0xFFF59E0B)),
                                const SizedBox(width: 2),
                                Text(
                                  '${place.savesCount}',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
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
