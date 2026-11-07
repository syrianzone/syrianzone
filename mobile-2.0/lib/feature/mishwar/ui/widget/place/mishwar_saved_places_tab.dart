import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:syrianzone/core/network/response/places_response.dart';
import 'package:syrianzone/feature/mishwar/logic/mishwar_cubit.dart';
import 'package:syrianzone/feature/mishwar/logic/mishwar_state.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/common/mishwar_error_view.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/common/mishwar_shimmer_list.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/place/place_card.dart';

class MishwarSavedPlacesTab extends StatefulWidget {
  final ScrollController? scrollController;
  final ValueChanged<PlaceResponse> onPlaceTap;

  const MishwarSavedPlacesTab({
    super.key,
    this.scrollController,
    required this.onPlaceTap,
  });

  @override
  State<MishwarSavedPlacesTab> createState() => _MishwarSavedPlacesTabState();
}

class _MishwarSavedPlacesTabState extends State<MishwarSavedPlacesTab> {
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
      if (cubit.state.hasMoreSavedPlaces && !cubit.state.isLoadingSavedPlaces) {
        cubit.fetchSavedPlaces();
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
          prev.savedPlaces != curr.savedPlaces ||
          prev.isLoadingSavedPlaces != curr.isLoadingSavedPlaces ||
          prev.savedPlacesError != curr.savedPlacesError ||
          prev.hasMoreSavedPlaces != curr.hasMoreSavedPlaces,
      builder: (context, state) {
        if (state.isLoadingSavedPlaces && state.savedPlaces.isEmpty) {
          return const MishwarShimmerList(type: MishwarShimmerType.place);
        }

        if (state.savedPlacesError != null && state.savedPlaces.isEmpty) {
          return MishwarErrorView(
            message: state.savedPlacesError!,
            onRetry: () => context.read<MishwarCubit>().fetchSavedPlaces(refresh: true),
          );
        }

        return RefreshIndicator(
          color: const Color(0xFF965B0E),
          onRefresh: () async {
            await context.read<MishwarCubit>().fetchSavedPlaces(refresh: true);
          },
          child: state.savedPlaces.isEmpty
              ? ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: [
                    const SizedBox(height: 60),
                    Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: const BoxDecoration(
                              color: Color(0xFFF3ECE3),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.bookmark_border_rounded,
                              size: 38,
                              color: Color(0xFF965B0E),
                            ),
                          ),
                          const SizedBox(height: 16),
                          const Text(
                            'لم تقم بحفظ أي أماكن بعد',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF2F2722),
                            ),
                          ),
                          const SizedBox(height: 8),
                          const Padding(
                            padding: EdgeInsets.symmetric(horizontal: 40),
                            child: Text(
                              'الأماكن التي تحفظها ستظهر هنا لتتمكن من الرجوع إليها بسهولة.',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 13,
                                color: Color(0xFF8D7E6E),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                )
              : ListView.builder(
                  controller: _scrollController,
                  physics: const AlwaysScrollableScrollPhysics(),
                  itemCount: state.savedPlaces.length + (state.hasMoreSavedPlaces ? 1 : 0),
                  itemBuilder: (context, index) {
                    if (index == state.savedPlaces.length) {
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
                    final place = state.savedPlaces[index];
                    return PlaceCard(
                      place: place,
                      onTap: () => widget.onPlaceTap(place),
                    );
                  },
                ),
        );
      },
    );
  }
}
