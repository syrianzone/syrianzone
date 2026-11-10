import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shimmer/shimmer.dart';
import 'package:syrianzone/core/network/response/guides_response.dart';
import 'package:syrianzone/core/util/text_util.dart';
import 'package:syrianzone/feature/mishwar/constants/mishwar_constants.dart';
import 'package:syrianzone/feature/mishwar/logic/guide/guide_detail_cubit.dart';
import 'package:syrianzone/feature/mishwar/logic/guide/guide_detail_state.dart';

class GuideDetailBottomSheet extends StatelessWidget {
  final GuideItemResponse guide;
  final VoidCallback onShowOnMap;
  final bool initialLoading;

  const GuideDetailBottomSheet({
    super.key,
    required this.guide,
    required this.onShowOnMap,
    this.initialLoading = false,
  });

  static Future<void> show(
    BuildContext context, {
    required GuideItemResponse guide,
    required VoidCallback onShowOnMap,
    bool initialLoading = true,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) {
        return BlocProvider(
          create: (_) {
            if (!initialLoading) {
              return GuideDetailCubit(initialState: GuideDetailState.success(guide));
            }
            final cubit = GuideDetailCubit();
            cubit.loadGuide(guide);
            return cubit;
          },
          child: GuideDetailBottomSheet(
            guide: guide,
            onShowOnMap: onShowOnMap,
            initialLoading: initialLoading,
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Container(
        decoration: const BoxDecoration(
          color: Color(0xFFFCFBF7),
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        child: SafeArea(
          top: false,
          child: Builder(
            builder: (context) {
              // If loaded without cubit (e.g. initialLoading is false and no BlocProvider in test)
              if (!initialLoading) {
                return _buildLoadedContent(context, guide);
              }

              return BlocBuilder<GuideDetailCubit, GuideDetailState>(
                builder: (context, state) {
                  return state.when(
                    initial: () => _buildGuideShimmer(),
                    loading: () => _buildGuideShimmer(),
                    success: (guide) => _buildLoadedContent(context, guide),
                    error: (message) => _buildErrorView(
                      message,
                      () => context.read<GuideDetailCubit>().loadGuide(guide),
                    ),
                  );
                },
              );
            },
          ),
        ),
      ),
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
              'تعذر تحميل بيانات المرشد',
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

  Widget _buildGuideShimmer() {
    return Shimmer.fromColors(
      baseColor: const Color(0xFFEAE3D6),
      highlightColor: const Color(0xFFF7F2E8),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Close button placeholder
          Align(
            alignment: Alignment.centerLeft,
            child: Container(
              width: 32,
              height: 32,
              decoration: const BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
              ),
            ),
          ),
          const SizedBox(height: 8),

          // Avatar circle shimmer
          Container(
            width: 90,
            height: 90,
            decoration: const BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(height: 14),

          // Name shimmer
          Container(
            width: 140,
            height: 22,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(6),
            ),
          ),
          const SizedBox(height: 10),

          // Badge pill shimmer
          Container(
            width: 110,
            height: 26,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
            ),
          ),
          const SizedBox(height: 20),

          // Points shimmer
          Container(
            width: 120,
            height: 38,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
            ),
          ),
          const SizedBox(height: 20),

          // 3 Stat cards shimmer
          Row(
            children: List.generate(
              3,
              (i) => Expanded(
                child: Container(
                  margin: EdgeInsets.only(left: i < 2 ? 10 : 0),
                  height: 60,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 22),

          // Progress bar shimmer
          Container(
            width: double.infinity,
            height: 9,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(6),
            ),
          ),
          const SizedBox(height: 24),

          // Action button shimmer
          Container(
            width: double.infinity,
            height: 48,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoadedContent(BuildContext context, GuideItemResponse guide) {
    final currentLevel = guide.level.clamp(1, 10);
    final currentRankName = MishwarConstants.getRankName(currentLevel);
    final nextLevel = currentLevel < 10 ? currentLevel + 1 : 10;
    final nextRankName = MishwarConstants.rankNames[nextLevel] ?? '';
    final currentThreshold = MishwarConstants.levelThresholds[currentLevel] ?? 0;
    final nextThreshold = MishwarConstants.levelThresholds[nextLevel] ?? currentThreshold;

    double progress = 1.0;
    if (nextThreshold > currentThreshold) {
      progress = ((guide.points - currentThreshold) / (nextThreshold - currentThreshold))
          .clamp(0.0, 1.0);
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Top close icon
        Align(
          alignment: Alignment.centerLeft,
          child: IconButton(
            icon: const Icon(Icons.close, color: Color(0xFF5A4D41)),
            onPressed: () => Navigator.pop(context),
            tooltip: 'إغلاق',
          ),
        ),

        // Large Avatar
        ClipOval(
          child: guide.avatarUrl != null && guide.avatarUrl!.isNotEmpty
              ? CachedNetworkImage(
                  imageUrl: guide.avatarUrl!,
                  width: 90,
                  height: 90,
                  fit: BoxFit.cover,
                  errorWidget: (_, _, _) => _buildAvatarFallback(guide.name),
                )
              : _buildAvatarFallback(guide.name),
        ),
        const SizedBox(height: 12),

        // Guide Name
        Text(
          guide.name,
          style: const TextStyle(
            color: Color(0xFF221A14),
            fontSize: 22,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 8),

        // Badge pill
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
          decoration: BoxDecoration(
            color: const Color(0xFFF3ECE1),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFD6C2A8), width: 1.2),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.location_on_outlined, size: 16, color: Color(0xFF9E5C0A)),
              const SizedBox(width: 4),
              const Icon(Icons.star, size: 15, color: Color(0xFF9E5C0A)),
              const SizedBox(width: 3),
              Text(
                '${guide.level}',
                style: const TextStyle(
                  color: Color(0xFF9E5C0A),
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(width: 6),
              Text(
                currentRankName,
                style: const TextStyle(
                  color: Color(0xFF9E5C0A),
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),

        // Big Points Number + "نقطة"
        Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Text(
              TextUtil.toArabicDigits(guide.points),
              style: const TextStyle(
                color: Color(0xFF221A14),
                fontSize: 42,
                fontWeight: FontWeight.w900,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(width: 8),
            const Text(
              'نقطة',
              style: TextStyle(
                color: Color(0xFF7A6D5E),
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),

        // 3 Stats in cards
        Row(
          children: [
            Expanded(
              child: _buildStatCard(
                value: TextUtil.toArabicDigits(guide.approvedCount),
                label: 'مساهمة',
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _buildStatCard(
                value: TextUtil.toArabicDigits(guide.savesTotal),
                label: 'حفظ',
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _buildStatCard(
                value: TextUtil.toArabicDigits(guide.recentCount),
                label: 'آخر 30 يوماً',
              ),
            ),
          ],
        ),
        const SizedBox(height: 22),

        // Level Progress
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 2.0),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                currentRankName,
                style: const TextStyle(
                  color: Color(0xFF221A14),
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(
                currentLevel < 10
                    ? '$nextRankName عند ${TextUtil.toArabicDigits(nextThreshold)}'
                    : 'المستوى الأقصى',
                style: const TextStyle(
                  color: Color(0xFF7A6D5E),
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: LinearProgressIndicator(
            value: progress,
            minHeight: 9,
            backgroundColor: const Color(0xFFEDE6DA),
            valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF9E5C0A)),
          ),
        ),
        const SizedBox(height: 24),

        // CTA Button: عرض المساهمات على الخريطة
        SizedBox(
          width: double.infinity,
          height: 48,
          child: FilledButton.icon(
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF9E5C0A),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            onPressed: () {
              Navigator.pop(context);
              onShowOnMap();
            },
            icon: const Icon(Icons.location_on_outlined, size: 20),
            label: const Text(
              'عرض المساهمات على الخريطة',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildStatCard({required String value, required String label}) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFF6F2EC),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            value,
            style: const TextStyle(
              color: Color(0xFF221A14),
              fontSize: 20,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(
              color: Color(0xFF7A6D5E),
              fontSize: 13,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAvatarFallback(String name) {
    final initials = name.isNotEmpty ? name[0].toUpperCase() : '?';
    return Container(
      width: 90,
      height: 90,
      decoration: const BoxDecoration(
        color: Color(0xFFEDE6DD),
        shape: BoxShape.circle,
      ),
      alignment: Alignment.center,
      child: Text(
        initials,
        style: const TextStyle(
          fontSize: 32,
          fontWeight: FontWeight.bold,
          color: Color(0xFF7A6D5E),
        ),
      ),
    );
  }
}
