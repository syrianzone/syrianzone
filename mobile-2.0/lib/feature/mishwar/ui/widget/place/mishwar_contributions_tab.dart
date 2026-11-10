import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:syrianzone/core/network/response/places_response.dart';
import 'package:syrianzone/feature/mishwar/logic/mishwar_cubit.dart';
import 'package:syrianzone/feature/mishwar/logic/mishwar_state.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/common/mishwar_error_view.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/common/mishwar_shimmer_list.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/place/place_card.dart';

class MishwarContributionsTab extends StatefulWidget {
  final ScrollController? scrollController;
  final ValueChanged<PlaceResponse> onPlaceTap;
  final VoidCallback onAddPlace;

  const MishwarContributionsTab({
    super.key,
    this.scrollController,
    required this.onPlaceTap,
    required this.onAddPlace,
  });

  @override
  State<MishwarContributionsTab> createState() => _MishwarContributionsTabState();
}

class _MishwarContributionsTabState extends State<MishwarContributionsTab> {
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
      if (cubit.state.hasMoreMyContributions && !cubit.state.isLoadingMyContributions) {
        cubit.fetchMyContributions();
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
          prev.myContributions != curr.myContributions ||
          prev.isLoadingMyContributions != curr.isLoadingMyContributions ||
          prev.myContributionsError != curr.myContributionsError ||
          prev.hasMoreMyContributions != curr.hasMoreMyContributions,
      builder: (context, state) {
        if (state.isLoadingMyContributions && state.myContributions.isEmpty) {
          return const MishwarShimmerList(type: MishwarShimmerType.place);
        }

        if (state.myContributionsError != null && state.myContributions.isEmpty) {
          return MishwarErrorView(
            message: state.myContributionsError!,
            onRetry: () => context.read<MishwarCubit>().fetchMyContributions(refresh: true),
          );
        }

        return RefreshIndicator(
          color: const Color(0xFF965B0E),
          onRefresh: () async {
            await context.read<MishwarCubit>().fetchMyContributions(refresh: true);
          },
          child: state.myContributions.isEmpty
              ? ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: [
                    const SizedBox(height: 50),
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
                              Icons.add_location_alt_outlined,
                              size: 38,
                              color: Color(0xFF965B0E),
                            ),
                          ),
                          const SizedBox(height: 16),
                          const Text(
                            'لم تقم بإضافة أي أماكن بعد',
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
                              'شارك أماكنك المفضلة والمواقع المميزة لتظهر للجميع بعد مراجعتها.',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 13,
                                color: Color(0xFF8D7E6E),
                              ),
                            ),
                          ),
                          const SizedBox(height: 18),
                          ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF965B0E),
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10),
                              ),
                              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                            ),
                            onPressed: widget.onAddPlace,
                            icon: const Icon(Icons.add, size: 18),
                            label: const Text(
                              'أضف مكاناً الآن',
                              style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
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
                  itemCount: state.myContributions.length + (state.hasMoreMyContributions ? 1 : 0),
                  itemBuilder: (context, index) {
                    if (index == state.myContributions.length) {
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
                    final place = state.myContributions[index];
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
