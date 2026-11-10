import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:syrianzone/core/network/response/hotel_response.dart';
import 'package:syrianzone/feature/mishwar/logic/mishwar_cubit.dart';
import 'package:syrianzone/feature/mishwar/logic/mishwar_state.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/common/mishwar_error_view.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/common/mishwar_shimmer_list.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/hotel/hotel_card.dart';

class MishwarHotelsTab extends StatefulWidget {
  final ScrollController? scrollController;
  final ValueChanged<HotelResponse> onHotelTap;

  const MishwarHotelsTab({
    super.key,
    this.scrollController,
    required this.onHotelTap,
  });

  @override
  State<MishwarHotelsTab> createState() => _MishwarHotelsTabState();
}

class _MishwarHotelsTabState extends State<MishwarHotelsTab> {
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
      if (cubit.state.hasMoreHotels && !cubit.state.isLoadingHotels) {
        cubit.fetchHotels();
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
          prev.hotels != curr.hotels ||
          prev.isLoadingHotels != curr.isLoadingHotels ||
          prev.hotelsError != curr.hotelsError ||
          prev.hasMoreHotels != curr.hasMoreHotels,
      builder: (context, state) {
        if (state.isLoadingHotels && state.hotels.isEmpty) {
          return const MishwarShimmerList(type: MishwarShimmerType.place);
        }
        if (state.hotelsError != null && state.hotels.isEmpty) {
          return MishwarErrorView(
            message: state.hotelsError!,
            onRetry: () => context.read<MishwarCubit>().fetchHotels(refresh: true),
          );
        }
        return RefreshIndicator(
          color: const Color(0xFF965B0E),
          onRefresh: () async {
            await context.read<MishwarCubit>().fetchHotels(refresh: true);
          },
          child: state.hotels.isEmpty
              ? ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: const [
                    SizedBox(height: 100),
                    Center(
                      child: Padding(
                        padding: EdgeInsets.all(24.0),
                        child: Text(
                          'لا توجد فنادق متاحة',
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
                  itemCount: state.hotels.length + (state.hasMoreHotels ? 1 : 0),
                  itemBuilder: (context, index) {
                    if (index == state.hotels.length) {
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
                    final hotel = state.hotels[index];
                    return HotelCard(
                      hotel: hotel,
                      onTap: () => widget.onHotelTap(hotel),
                    );
                  },
                ),
        );
      },
    );
  }
}
