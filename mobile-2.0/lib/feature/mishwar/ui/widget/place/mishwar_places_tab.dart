import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:syrianzone/core/network/response/places_response.dart';
import 'package:syrianzone/feature/mishwar/logic/mishwar_cubit.dart';
import 'package:syrianzone/feature/mishwar/logic/mishwar_state.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/common/mishwar_error_view.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/common/mishwar_shimmer_list.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/place/place_card.dart';

class MishwarPlacesTab extends StatefulWidget {
  final ScrollController? scrollController;
  final ValueChanged<PlaceResponse> onPlaceTap;

  const MishwarPlacesTab({
    super.key,
    this.scrollController,
    required this.onPlaceTap,
  });

  @override
  State<MishwarPlacesTab> createState() => _MishwarPlacesTabState();
}

class _MishwarPlacesTabState extends State<MishwarPlacesTab> {
  late final ScrollController _scrollController;
  bool _ownsController = false;

  @override
  void initState() {
    super.initState();
    if (widget.scrollController != null) {
      _scrollController = widget.scrollController!;
    } else {
      _scrollController = ScrollController();
      _ownsController = true;
    }
    _scrollController.addListener(_onScroll);
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      final cubit = context.read<MishwarCubit>();
      if (cubit.state.hasMorePlaces && !cubit.state.isLoadingPlaces) {
        cubit.fetchPlaces();
      }
    }
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    if (_ownsController) {
      _scrollController.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<MishwarCubit, MishwarState>(
      buildWhen: (prev, curr) =>
          prev.places != curr.places ||
          prev.isLoadingPlaces != curr.isLoadingPlaces ||
          prev.placesError != curr.placesError ||
          prev.hasMorePlaces != curr.hasMorePlaces ||
          prev.selectedCategory != curr.selectedCategory ||
          prev.filterUserId != curr.filterUserId ||
          prev.filterUserName != curr.filterUserName,
      builder: (context, state) {
        return Column(
          children: [
            // Active Guide Filter banner
            if (state.filterUserId != null)
              Container(
                margin: const EdgeInsets.fromLTRB(16, 6, 16, 4),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFFF3ECE3),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFDFCFC0)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.person_pin_circle_outlined, size: 18, color: Color(0xFF965B0E)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'أماكن أضافها: ${state.filterUserName ?? ''}',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF2F2722),
                        ),
                      ),
                    ),
                    InkWell(
                      onTap: () => context.read<MishwarCubit>().clearUserFilter(),
                      child: Container(
                        padding: const EdgeInsets.all(2),
                        decoration: const BoxDecoration(
                          color: Color(0xFFE4D8C8),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.close, size: 14, color: Color(0xFF5A4D41)),
                      ),
                    ),
                  ],
                ),
              ),

            // List
            Expanded(
              child: state.isLoadingPlaces && state.places.isEmpty
                  ? const MishwarShimmerList(type: MishwarShimmerType.place)
                  : state.placesError != null && state.places.isEmpty
                      ? MishwarErrorView(
                          message: state.placesError!,
                          onRetry: () => context.read<MishwarCubit>().fetchPlaces(refresh: true),
                        )
                      : RefreshIndicator(
                          color: const Color(0xFF965B0E),
                          onRefresh: () async {
                            await context.read<MishwarCubit>().fetchPlaces(refresh: true);
                          },
                          child: state.places.isEmpty
                              ? ListView(
                                  physics: const AlwaysScrollableScrollPhysics(),
                                  children: const [
                                    SizedBox(height: 100),
                                    Center(
                                      child: Padding(
                                        padding: EdgeInsets.all(24.0),
                                        child: Text(
                                          'لا توجد أماكن متاحة',
                                          textAlign: TextAlign.center,
                                          style: TextStyle(
                                            fontSize: 14,
                                            fontWeight: FontWeight.w600,
                                            color: Color(0xFF5A4D41),
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                )
                              : ListView.builder(
                                  controller: _scrollController,
                                  physics: const AlwaysScrollableScrollPhysics(),
                                  itemCount: state.places.length + (state.hasMorePlaces ? 1 : 0),
                                  itemBuilder: (context, index) {
                                    if (index == state.places.length) {
                                      return const Padding(
                                        padding: EdgeInsets.symmetric(vertical: 16),
                                        child: Center(
                                          child: SizedBox(
                                            width: 24,
                                            height: 24,
                                            child: CircularProgressIndicator(strokeWidth: 2),
                                          ),
                                        ),
                                      );
                                    }
                                    final place = state.places[index];
                                    return PlaceCard(
                                      place: place,
                                      onTap: () => widget.onPlaceTap(place),
                                    );
                                  },
                                ),
                        ),
            ),
          ],
        );
      },
    );
  }
}
