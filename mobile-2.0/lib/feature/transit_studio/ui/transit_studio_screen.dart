import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../logic/transit_studio_cubit.dart';
import '../logic/transit_studio_state.dart';
import 'widget/transit_studio_form_pane.dart';
import 'widget/transit_studio_map_pane.dart';

class TransitStudioScreen extends StatelessWidget {
  const TransitStudioScreen({super.key});

  Future<void> _confirmReset(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          title: const Text('إعادة ضبط الاستوديو؟'),
          content: const Text(
            'هل أنت متأكد من مسح جميع البيانات والنقاط والمحطات والبدء من جديد؟',
            style: TextStyle(fontSize: 14),
          ),
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
              child: const Text('إعادة ضبط'),
            ),
          ],
        ),
      ),
    );

    if (confirmed == true && context.mounted) {
      context.read<TransitStudioCubit>().resetAll();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(
          title: const Text(
            'استوديو ترانزيت',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
          ),
          centerTitle: true,
          actions: [
            BlocBuilder<TransitStudioCubit, TransitStudioState>(
              buildWhen: (prev, curr) => prev.isSubmitting != curr.isSubmitting,
              builder: (context, state) {
                return IconButton(
                  icon: const Icon(Icons.refresh_rounded),
                  tooltip: 'إعادة ضبط',
                  onPressed: state.isSubmitting
                      ? null
                      : () => _confirmReset(context),
                );
              },
            ),
          ],
        ),
        body: SafeArea(
          child: Column(
            children: [
              BlocBuilder<TransitStudioCubit, TransitStudioState>(
                buildWhen: (prev, curr) =>
                    prev.editingDraftId != curr.editingDraftId ||
                    prev.editingDraftTitle != curr.editingDraftTitle,
                builder: (context, state) {
                  if (state.editingDraftId == null) {
                    return const SizedBox.shrink();
                  }
                  return Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                    color: const Color(0xFFFEF3C7),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.edit_note_rounded,
                          color: Color(0xFF92400E),
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'أنت تقوم بتعديل المسودة: ${state.editingDraftTitle ?? ''}',
                            style: const TextStyle(
                              color: Color(0xFF92400E),
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
              // Top Half: Interactive OSM Map Pane
              const Expanded(
                flex: 5,
                child: TransitStudioMapPane(),
              ),

              // Bottom Half: Accordion Form Pane
              const Expanded(
                flex: 5,
                child: TransitStudioFormPane(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
