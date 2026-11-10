import 'package:flutter/material.dart';
import 'package:syrianzone/feature/mishwar/constants/mishwar_constants.dart';

class MishwarFilterBottomSheet extends StatefulWidget {
  final String selectedType; // 'all', 'places', 'hotels'
  final String? selectedCategory;
  final ValueChanged<String> onTypeChanged;
  final ValueChanged<String?> onCategoryChanged;

  const MishwarFilterBottomSheet({
    super.key,
    required this.selectedType,
    required this.selectedCategory,
    required this.onTypeChanged,
    required this.onCategoryChanged,
  });

  static Future<void> show(
    BuildContext context, {
    required String selectedType,
    required String? selectedCategory,
    required ValueChanged<String> onTypeChanged,
    required ValueChanged<String?> onCategoryChanged,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => MishwarFilterBottomSheet(
        selectedType: selectedType,
        selectedCategory: selectedCategory,
        onTypeChanged: onTypeChanged,
        onCategoryChanged: onCategoryChanged,
      ),
    );
  }

  @override
  State<MishwarFilterBottomSheet> createState() => _MishwarFilterBottomSheetState();
}

class _MishwarFilterBottomSheetState extends State<MishwarFilterBottomSheet> {
  late String _currentType;
  late String? _currentCategory;

  @override
  void initState() {
    super.initState();
    _currentType = widget.selectedType;
    _currentCategory = widget.selectedCategory;
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Container(
        decoration: const BoxDecoration(
          color: Color(0xFFFCFBF7),
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          boxShadow: [
            BoxShadow(
              color: Color(0x28000000),
              blurRadius: 16,
              offset: Offset(0, -4),
            ),
          ],
        ),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Handle bar
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: const Color(0xFFD6C8B4),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),

            // Header Row
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'تصفية',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF2F2722),
                  ),
                ),
                if (_currentType != 'all' || _currentCategory != null)
                  TextButton(
                    onPressed: () {
                      setState(() {
                        _currentType = 'all';
                        _currentCategory = null;
                      });
                      widget.onTypeChanged('all');
                      widget.onCategoryChanged(null);
                    },
                    child: const Text(
                      'إعادة تعيين',
                      style: TextStyle(
                        fontSize: 13,
                        color: Color(0xFF965B0E),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 14),

            // Section 1: Type (النوع)
            const Text(
              'النوع',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: Color(0xFF5A4D41),
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _buildTypeChip('الكل', 'all'),
                _buildTypeChip('أماكن', 'places'),
                _buildTypeChip('فنادق', 'hotels'),
              ],
            ),

            const SizedBox(height: 20),

            // Section 2: Category (الفئة)
            const Text(
              'الفئة',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: Color(0xFF5A4D41),
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _buildCategoryChip('الكل', null),
                ...MishwarConstants.placeCategories.map((c) {
                  return _buildCategoryChip(c['label']!, c['key']);
                }),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTypeChip(String label, String typeKey) {
    final isSelected = _currentType == typeKey;
    return InkWell(
      onTap: () {
        setState(() {
          _currentType = typeKey;
        });
        widget.onTypeChanged(typeKey);
      },
      borderRadius: BorderRadius.circular(20),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF965B0E) : const Color(0xFFFAF6F0),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? const Color(0xFF965B0E) : const Color(0xFFE5DDD0),
          ),
          boxShadow: isSelected
              ? const [
                  BoxShadow(
                    color: Color(0x33965B0E),
                    blurRadius: 6,
                    offset: Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : const Color(0xFF2F2722),
            fontSize: 13,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
      ),
    );
  }

  Widget _buildCategoryChip(String label, String? categoryKey) {
    final isSelected = _currentCategory == categoryKey;
    return InkWell(
      onTap: () {
        setState(() {
          _currentCategory = categoryKey;
        });
        widget.onCategoryChanged(categoryKey);
        Navigator.pop(context);
      },
      borderRadius: BorderRadius.circular(20),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF965B0E) : const Color(0xFFFAF6F0),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? const Color(0xFF965B0E) : const Color(0xFFE5DDD0),
          ),
          boxShadow: isSelected
              ? const [
                  BoxShadow(
                    color: Color(0x33965B0E),
                    blurRadius: 6,
                    offset: Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : const Color(0xFF2F2722),
            fontSize: 13,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
      ),
    );
  }
}
