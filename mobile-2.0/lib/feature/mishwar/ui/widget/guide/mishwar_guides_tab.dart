import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:syrianzone/core/network/response/guides_response.dart';
import 'package:syrianzone/feature/mishwar/constants/mishwar_constants.dart';
import 'package:syrianzone/feature/mishwar/logic/mishwar_cubit.dart';
import 'package:syrianzone/feature/mishwar/logic/mishwar_state.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/common/mishwar_error_view.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/common/mishwar_shimmer_list.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/guide/guide_detail_bottom_sheet.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/guide/guide_tile.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/guide/mishwar_ranks_bottom_sheet.dart';

class MishwarGuidesTab extends StatelessWidget {
  final ValueChanged<GuideItemResponse> onShowGuideOnMap;

  const MishwarGuidesTab({
    super.key,
    required this.onShowGuideOnMap,
  });

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<MishwarCubit, MishwarState>(
      buildWhen: (prev, curr) =>
          prev.guides != curr.guides ||
          prev.isLoadingGuides != curr.isLoadingGuides ||
          prev.guidesError != curr.guidesError ||
          prev.guidesSort != curr.guidesSort,
      builder: (context, state) {
        return Column(
          children: [
            // Header Bar: "المرشدون المحليون" and "الرتب" button
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'المرشدون المحليون',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF2F2722),
                    ),
                  ),
                  InkWell(
                    onTap: () => MishwarRanksBottomSheet.show(context),
                    borderRadius: BorderRadius.circular(16),
                    child: const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.military_tech_outlined,
                            size: 16,
                            color: Color(0xFF965B0E),
                          ),
                          SizedBox(width: 4),
                          Text(
                            'الرتب',
                            style: TextStyle(
                              fontSize: 13.5,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF965B0E),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Header with Sort chips
            SizedBox(
              height: 44,
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                scrollDirection: Axis.horizontal,
                itemCount: MishwarConstants.guideSorts.length,
                separatorBuilder: (context, index) => const SizedBox(width: 6),
                itemBuilder: (context, index) {
                  final sort = MishwarConstants.guideSorts[index];
                  final isSelected = state.guidesSort == sort['key'];
                  return ChoiceChip(
                    showCheckmark: false,
                    label: Text(sort['label']!),
                    selected: isSelected,
                    onSelected: (_) {
                      context.read<MishwarCubit>().fetchGuides(sort: sort['key']);
                    },
                    selectedColor: const Color(0xFF965B0E),
                    labelStyle: TextStyle(
                      color: isSelected ? Colors.white : const Color(0xFF5A4D41),
                      fontSize: 12,
                      fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                    ),
                    backgroundColor: const Color(0xFFF9F6F0),
                    side: BorderSide(
                      color: isSelected ? const Color(0xFF965B0E) : const Color(0xFFEFE6DA),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                  );
                },
              ),
            ),

            // List
            Expanded(
              child: state.isLoadingGuides && state.guides.isEmpty
                  ? const MishwarShimmerList(type: MishwarShimmerType.guide)
                  : state.guidesError != null && state.guides.isEmpty
                      ? MishwarErrorView(
                          message: state.guidesError!,
                          onRetry: () => context.read<MishwarCubit>().fetchGuides(),
                        )
                      : RefreshIndicator(
                          color: const Color(0xFF965B0E),
                          onRefresh: () async {
                            await context.read<MishwarCubit>().fetchGuides();
                          },
                          child: state.guides.isEmpty
                              ? ListView(
                                  physics: const AlwaysScrollableScrollPhysics(),
                                  children: const [
                                    SizedBox(height: 100),
                                    Center(
                                      child: Padding(
                                        padding: EdgeInsets.all(24.0),
                                        child: Text(
                                          'لا يوجد مرشدون حالياً',
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
                                  physics: const AlwaysScrollableScrollPhysics(),
                                  itemCount: state.guides.length,
                                  itemBuilder: (context, index) {
                                    final guide = state.guides[index];
                                    return GuideTile(
                                      guide: guide,
                                      onTap: () {
                                        GuideDetailBottomSheet.show(
                                          context,
                                          guide: guide,
                                          onShowOnMap: () => onShowGuideOnMap(guide),
                                        );
                                      },
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
