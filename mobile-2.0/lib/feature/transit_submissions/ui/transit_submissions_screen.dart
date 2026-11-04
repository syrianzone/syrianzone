import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:syrianzone/core/extensions/navigation_extensions.dart';
import 'package:syrianzone/core/network/response/user_submissions_response.dart';
import 'package:syrianzone/core/routing/routes.dart';
import 'package:syrianzone/core/util/text_util.dart';
import '../logic/transit_submissions_cubit.dart';
import '../logic/transit_submissions_state.dart';
import 'widget/transit_submissions_shimmer.dart';

class TransitSubmissionsScreen extends StatelessWidget {
  const TransitSubmissionsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: const Color(0xFFFAF8F5),
        appBar: AppBar(
          title: const Text(
            '🚊 سجل اقتراحات المسارات الخاصة بك',
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 17,
              color: Color(0xFF2F2722),
            ),
          ),
          centerTitle: false,
          backgroundColor: Colors.transparent,
          elevation: 0,
        ),
        body: BlocConsumer<TransitSubmissionsCubit, TransitSubmissionsState>(
          listenWhen: (previous, current) =>
              current.actionError != null &&
              current.actionError != previous.actionError,
          listener: (context, state) {
            if (state.actionError != null) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(state.actionError!),
                  backgroundColor: const Color(0xFFB23A48),
                ),
              );
              context.read<TransitSubmissionsCubit>().clearActionError();
            }
          },
          builder: (context, state) {
            if (state.isLoading && state.submissions.isEmpty) {
              return const TransitSubmissionsShimmer();
            }
            if (state.errorMessage != null && state.submissions.isEmpty) {
              return _buildErrorView(context, state.errorMessage!);
            }
            if (state.submissions.isEmpty) {
              return _buildEmptyView(context);
            }
            return RefreshIndicator(
              color: const Color(0xFF9E5A0B),
              onRefresh: () =>
                  context.read<TransitSubmissionsCubit>().loadSubmissions(),
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 20,
                ),
                itemCount: state.submissions.length,
                separatorBuilder: (separatorContext, separatorIndex) =>
                    const SizedBox(height: 14),
                itemBuilder: (ctx, index) {
                  final item = state.submissions[index];
                  return _buildSubmissionCard(
                    ctx,
                    item,
                    isDeleting: state.deletingIds.contains(item.id),
                    isAnyDeleting: state.deletingIds.isNotEmpty,
                  );
                },
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildSubmissionCard(
    BuildContext context,
    RouteDraftItem draft, {
    bool isDeleting = false,
    bool isAnyDeleting = false,
  }) {
    final cityName = draft.city?.nameAr ?? draft.cityId;
    final dateStr = _formatDate(draft.createdAt);
    final isPending = draft.status == 'pending';

    return AnimatedOpacity(
      duration: const Duration(milliseconds: 200),
      opacity: isDeleting ? 0.5 : 1.0,
      child: Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE4D8C8)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x08000000),
            blurRadius: 4,
            offset: Offset(0, 1),
          ),
        ],
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 1. Top Section: Title, English Name, and Status Badge (expands horizontally across the full card)
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Wrap(
                  spacing: 8,
                  runSpacing: 4,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(
                      draft.nameAr,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF2F2722),
                      ),
                    ),
                    if (draft.nameEn != null &&
                        draft.nameEn!.trim().isNotEmpty)
                      Text(
                        '(${draft.nameEn!.trim()})',
                        style: const TextStyle(
                          fontSize: 13,
                          color: Color(0xFF85786E),
                        ),
                      ),
                    _buildStatusBadge(draft.status),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // 2. Bottom Section: City & Date on Right (RTL start), Action Buttons on Left (RTL end)
          Row(
            children: [
              Expanded(
                child: Text(
                  'المدينة: $cityName • تاريخ التقديم: $dateStr',
                  style: const TextStyle(
                    fontSize: 11.5,
                    color: Color(0xFF85786E),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (isPending) ...[
                    OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFB23A48),
                        side: const BorderSide(color: Color(0xFFE4C5C5)),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 14,
                        ),
                        minimumSize: Size.zero,
                        visualDensity: VisualDensity.compact,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                      onPressed: isAnyDeleting
                          ? null
                          : () => _confirmWithdrawOrDelete(
                                context,
                                draft,
                                isWithdraw: true,
                              ),
                      child: isDeleting
                          ? const SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Color(0xFFB23A48),
                              ),
                            )
                          : const Text(
                              'سحب الاقتراح',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                    ),
                    const SizedBox(width: 8),
                    OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF4A443F),
                        side: const BorderSide(color: Color(0xFFD4CDC5)),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 14,
                        ),
                        minimumSize: Size.zero,
                        visualDensity: VisualDensity.compact,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                      onPressed: isAnyDeleting
                          ? null
                          : () async {
                              await context.pushNamed(
                                Routes.transitStudio,
                                arguments: draft,
                              );
                              if (context.mounted) {
                                context
                                    .read<TransitSubmissionsCubit>()
                                    .loadSubmissions();
                              }
                            },
                      child: const Text(
                        'تعديل',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ] else ...[
                    OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFB23A48),
                        side: const BorderSide(color: Color(0xFFE4C5C5)),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 6,
                        ),
                        minimumSize: Size.zero,
                        visualDensity: VisualDensity.compact,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                      onPressed: isAnyDeleting
                          ? null
                          : () => _confirmWithdrawOrDelete(
                                context,
                                draft,
                                isWithdraw: false,
                              ),
                      child: isDeleting
                          ? const SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Color(0xFFB23A48),
                              ),
                            )
                          : const Text(
                              'حذف',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                    ),
                  ],
                ],
              ),
            ],
          ),
          if (draft.status == 'rejected' &&
              draft.rejectionReason != null &&
              draft.rejectionReason!.trim().isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFFFDF0F0),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                'سبب الرفض: ${draft.rejectionReason!}',
                style: const TextStyle(
                  color: Color(0xFFB23A48),
                  fontSize: 11.5,
                ),
              ),
            ),
          ],
        ],
      ),
    ),
    );
  }

  Widget _buildStatusBadge(String status) {
    Color bg;
    Color text;
    String label;

    switch (status) {
      case 'approved':
        bg = const Color(0xFFE8F5E9);
        text = const Color(0xFF2E7D32);
        label = 'مقبول';
        break;
      case 'rejected':
        bg = const Color(0xFFFDE8E8);
        text = const Color(0xFFB23A48);
        label = 'مرفوض';
        break;
      case 'pending':
      default:
        bg = const Color(0xFFFEF3C7);
        text = const Color(0xFFB45309);
        label = 'قيد المراجعة';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: text,
          fontSize: 11,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  Future<void> _confirmWithdrawOrDelete(
    BuildContext context,
    RouteDraftItem draft, {
    required bool isWithdraw,
  }) async {
    final title = isWithdraw ? 'سحب الاقتراح' : 'حذف الاقتراح';
    final content = isWithdraw
        ? 'هل أنت متأكد من رغبتك في سحب اقتراح المسار "${draft.nameAr}"؟'
        : 'هل أنت متأكد من رغبتك في حذف هذا الاقتراح من سجلك؟';
    final actionText = isWithdraw ? 'تأكيد السحب' : 'حذف';

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          title: Text(title),
          content: Text(content, style: const TextStyle(fontSize: 14)),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('إلغاء'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFB23A48),
                foregroundColor: Colors.white,
              ),
              onPressed: () => Navigator.of(ctx).pop(true),
              child: Text(actionText),
            ),
          ],
        ),
      ),
    );

    if (confirmed == true && context.mounted) {
      final success = await context
          .read<TransitSubmissionsCubit>()
          .withdrawOrDelete(draft.id);

      if (success && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              isWithdraw
                  ? 'تم سحب الاقتراح بنجاح'
                  : 'تم حذف الاقتراح بنجاح',
            ),
            backgroundColor: const Color(0xFF4B7F52),
          ),
        );
      }
    }
  }

  Widget _buildEmptyView(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: const BoxDecoration(
                color: Color(0xFFF1EDE6),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.alt_route_rounded,
                size: 36,
                color: Color(0xFF9E5A0B),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'لا توجد اقتراحات مسارات',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.bold,
                color: Color(0xFF2F2722),
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'لم تقم بإرسال أي اقتراحات مسارات بعد. يمكنك استخدام استوديو ترانزيت لرسم واقتراح مسارات ومحطات جديدة.',
              style: TextStyle(
                fontSize: 13,
                color: Color(0xFF85786E),
                height: 1.4,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF9E5A0B),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 12,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              onPressed: () {
                context.pushReplacementNamed(Routes.transitStudio);
              },
              icon: const Icon(Icons.add_location_alt_outlined, size: 18),
              label: const Text(
                'فتح استوديو ترانزيت',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorView(BuildContext context, String message) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.error_outline_rounded,
              color: Color(0xFFB23A48),
              size: 48,
            ),
            const SizedBox(height: 12),
            Text(
              message,
              style: const TextStyle(
                fontSize: 14,
                color: Color(0xFF2F2722),
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF9E5A0B),
                foregroundColor: Colors.white,
              ),
              onPressed: () =>
                  context.read<TransitSubmissionsCubit>().loadSubmissions(),
              child: const Text('إعادة المحاولة'),
            ),
          ],
        ),
      ),
    );
  }

  String _formatDate(String? raw) {
    if (raw == null || raw.isEmpty) return '—';
    final date = DateTime.tryParse(raw)?.toLocal();
    if (date == null) return raw;

    final westernDate =
        '${date.year}/${date.month.toString().padLeft(2, '0')}/${date.day.toString().padLeft(2, '0')}';

    return TextUtil.toArabicDigits(westernDate);
  }
}
