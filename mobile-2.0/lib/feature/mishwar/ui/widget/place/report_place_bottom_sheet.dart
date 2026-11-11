import 'package:flutter/material.dart';
import 'package:syrianzone/core/di/get_it.dart';
import 'package:syrianzone/core/network/api_result.dart';
import 'package:syrianzone/feature/mishwar/repo/mishwar_repo.dart';

/// Lets a signed-in user flag a published place for moderators
/// (Google Play user-generated-content requirement).
///
/// Resolves to the server's confirmation message, or null if dismissed.
class ReportPlaceBottomSheet extends StatefulWidget {
  final int placeId;
  final String placeName;

  const ReportPlaceBottomSheet({
    super.key,
    required this.placeId,
    required this.placeName,
  });

  static Future<String?> show(
    BuildContext context, {
    required int placeId,
    required String placeName,
  }) {
    return showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => ReportPlaceBottomSheet(placeId: placeId, placeName: placeName),
    );
  }

  @override
  State<ReportPlaceBottomSheet> createState() => _ReportPlaceBottomSheetState();
}

class _ReportPlaceBottomSheetState extends State<ReportPlaceBottomSheet> {
  // Keys match PlaceReport::REASONS on the server.
  static const _reasons = <(String, String)>[
    ('inappropriate', 'محتوى مسيء أو غير لائق'),
    ('spam', 'محتوى مزعج أو إعلاني'),
    ('wrong_info', 'معلومات خاطئة'),
    ('duplicate', 'مكان مكرر'),
    ('other', 'سبب آخر'),
  ];

  static const _brown = Color(0xFF965B0E);
  static const _ink = Color(0xFF2F2722);

  final _detailsController = TextEditingController();
  String? _reason;
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _detailsController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_reason == null || _submitting) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    final result = await getIt<MishwarRepo>().reportPlace(
      widget.placeId,
      reason: _reason!,
      details: _detailsController.text.trim(),
    );
    if (!mounted) return;
    result.when(
      success: (message) => Navigator.pop(context, message),
      error: (error) => setState(() {
        _submitting = false;
        _error = error;
      }),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                Center(
                  child: Container(
                    width: 36,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey.shade300,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Semantics(
                  header: true,
                  child: Text(
                    'الإبلاغ عن «${widget.placeName}»',
                    style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: _ink),
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'يراجع فريق الإشراف البلاغ ويخفي المكان إن خالف الشروط.',
                  style: TextStyle(fontSize: 13, color: Color(0xFF6B5E52)),
                ),
                const SizedBox(height: 12),
                for (final (key, label) in _reasons)
                  Semantics(
                    inMutuallyExclusiveGroup: true,
                    checked: _reason == key,
                    child: ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 4),
                      leading: Icon(
                        _reason == key ? Icons.radio_button_checked : Icons.radio_button_unchecked,
                        color: _reason == key ? _brown : const Color(0xFF8D7E6E),
                      ),
                      title: Text(label, style: const TextStyle(fontSize: 14, color: _ink)),
                      onTap: _submitting ? null : () => setState(() => _reason = key),
                    ),
                  ),
                const SizedBox(height: 8),
                TextField(
                  controller: _detailsController,
                  maxLength: 1000,
                  maxLines: 3,
                  enabled: !_submitting,
                  decoration: InputDecoration(
                    labelText: 'تفاصيل (اختياري)',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(color: _brown),
                    ),
                  ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    _error!,
                    style: const TextStyle(fontSize: 13, color: Color(0xFFDC2626)),
                  ),
                ],
                const SizedBox(height: 12),
                FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: _brown,
                    foregroundColor: Colors.white,
                    minimumSize: const Size.fromHeight(46),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: _reason == null || _submitting ? null : _submit,
                  child: _submitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Text(
                          'إرسال البلاغ',
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                        ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
