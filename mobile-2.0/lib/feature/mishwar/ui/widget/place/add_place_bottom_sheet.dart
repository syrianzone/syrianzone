import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';
import 'package:syrianzone/feature/mishwar/constants/mishwar_constants.dart';
import 'package:syrianzone/feature/mishwar/logic/mishwar_cubit.dart';
import 'package:syrianzone/feature/mishwar/logic/mishwar_state.dart';

class AddPlaceBottomSheet extends StatefulWidget {
  final double lat;
  final double lng;

  const AddPlaceBottomSheet({
    super.key,
    required this.lat,
    required this.lng,
  });

  static Future<void> show(
    BuildContext context, {
    required double lat,
    required double lng,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => BlocProvider.value(
        value: context.read<MishwarCubit>(),
        child: AddPlaceBottomSheet(lat: lat, lng: lng),
      ),
    );
  }

  @override
  State<AddPlaceBottomSheet> createState() => _AddPlaceBottomSheetState();
}

class _AddPlaceBottomSheetState extends State<AddPlaceBottomSheet> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _descriptionController = TextEditingController();
  final ImagePicker _imagePicker = ImagePicker();

  String? _selectedCategory;
  String? _categoryError;
  String? _photoError;
  String? _errorMessage;
  final List<XFile> _selectedPhotos = [];

  @override
  void initState() {
    super.initState();
    _descriptionController.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _nameController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _pickPhotos() async {
    final remaining = 10 - _selectedPhotos.length;
    if (remaining <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('الحد الأقصى هو 10 صور')),
      );
      return;
    }

    try {
      final picked = await _imagePicker.pickMultiImage(limit: remaining);
      if (picked.isNotEmpty) {
        setState(() {
          for (final file in picked) {
            if (_selectedPhotos.length < 10) {
              _selectedPhotos.add(file);
            }
          }
          _photoError = null;
        });
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('فشل اختيار الصور: $e')),
      );
    }
  }

  void _removePhoto(int index) {
    setState(() {
      _selectedPhotos.removeAt(index);
    });
  }

  Future<void> _submit() async {
    setState(() {
      _categoryError = _selectedCategory == null ? 'يرجى اختيار التصنيف' : null;
      _photoError = _selectedPhotos.isEmpty ? 'يرجى اختيار صورة واحدة على الأقل' : null;
    });

    if (!_formKey.currentState!.validate() ||
        _categoryError != null ||
        _photoError != null) {
      return;
    }

    final cubit = context.read<MishwarCubit>();
    final success = await cubit.submitPlace(
      name: _nameController.text.trim(),
      category: _selectedCategory!,
      description: _descriptionController.text.trim(),
      lat: widget.lat,
      lng: widget.lng,
      photoPaths: _selectedPhotos.map((p) => p.path).toList(),
    );

    if (!mounted) return;

    if (success) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('تم إرسال المكان بنجاح! سيظهر على الخريطة بعد موافقة المشرفين.'),
          backgroundColor: Color(0xFF2E6B34),
          duration: Duration(seconds: 4),
        ),
      );
    } else {
      final error = cubit.state.submitPlaceError ?? 'حدث خطأ أثناء إرسال المكان';
      setState(() {
        _errorMessage = error;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<MishwarCubit, MishwarState>(
      builder: (context, state) {
        final isSubmitting = state.isSubmittingPlace;

        return DraggableScrollableSheet(
          initialChildSize: 0.92,
          minChildSize: 0.5,
          maxChildSize: 0.96,
          builder: (context, scrollController) {
            return Directionality(
              textDirection: TextDirection.rtl,
              child: Container(
                decoration: const BoxDecoration(
                  color: Color(0xFFFCFBF7),
                  borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                ),
                child: Column(
                  children: [
                    // Drag handle
                    Container(
                      margin: const EdgeInsets.only(top: 10, bottom: 6),
                      width: 36,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.grey.shade300,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),

                    // Top Bar with Close button & Header
                    Padding(
                      padding: const EdgeInsets.fromLTRB(20, 6, 20, 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text(
                                'إضافة مكان جديد',
                                style: TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF221A14),
                                ),
                              ),
                              Container(
                                width: 34,
                                height: 34,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  border: Border.all(color: const Color(0xFFD6C2A8)),
                                ),
                                child: IconButton(
                                  padding: EdgeInsets.zero,
                                  icon: const Icon(Icons.close, size: 18, color: Color(0xFF9E5C0A)),
                                  onPressed: () => Navigator.pop(context),
                                  tooltip: 'إغلاق',
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          const Text(
                            'شارك مكاناً يستحق المشوار ليظهر على الخريطة بعد موافقة المشرفين',
                            style: TextStyle(
                              fontSize: 13,
                              color: Color(0xFF7A6D5E),
                              height: 1.4,
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Scrollable Form Fields
                    Expanded(
                      child: Form(
                        key: _formKey,
                        child: ListView(
                          controller: scrollController,
                          padding: const EdgeInsets.symmetric(horizontal: 20),
                          children: [
                            // Inline Submit Error Banner
                            if (_errorMessage != null) ...[
                              Container(
                                margin: const EdgeInsets.only(bottom: 16),
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFEF2F2),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: const Color(0xFFF87171)),
                                ),
                                child: Row(
                                  children: [
                                    const Icon(Icons.error_outline, color: Color(0xFFDC2626), size: 20),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        _errorMessage!,
                                        style: const TextStyle(
                                          color: Color(0xFF991B1B),
                                          fontSize: 13,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ),
                                    InkWell(
                                      onTap: () => setState(() => _errorMessage = null),
                                      child: const Icon(Icons.close, size: 16, color: Color(0xFF991B1B)),
                                    ),
                                  ],
                                ),
                              ),
                            ],

                            // 1. اسم المكان
                            _buildLabel('اسم المكان'),
                            const SizedBox(height: 6),
                            TextFormField(
                              controller: _nameController,
                              style: const TextStyle(fontSize: 14, color: Color(0xFF221A14)),
                              decoration: _inputDecoration(hintText: 'مثال: مقهى النوفرة'),
                              validator: (value) {
                                if (value == null || value.trim().isEmpty) {
                                  return 'يرجى إدخال اسم المكان';
                                }
                                if (value.trim().length > 160) {
                                  return 'اسم المكان يجب ألا يتجاوز 160 حرفاً';
                                }
                                return null;
                              },
                            ),
                            const SizedBox(height: 16),

                            // 2. التصنيف
                            _buildLabel('التصنيف'),
                            const SizedBox(height: 6),
                            _buildCategorySelector(),
                            if (_categoryError != null) ...[
                              const SizedBox(height: 4),
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 12),
                                child: Text(
                                  _categoryError!,
                                  style: TextStyle(color: Colors.red.shade700, fontSize: 12),
                                ),
                              ),
                            ],
                            const SizedBox(height: 16),

                            // 3. الوصف
                            _buildLabel('الوصف'),
                            const SizedBox(height: 6),
                            TextFormField(
                              controller: _descriptionController,
                              maxLines: 4,
                              style: const TextStyle(fontSize: 14, color: Color(0xFF221A14)),
                              decoration: _inputDecoration(
                                hintText: 'صف المكان وما يميزه (20 حرفاً على الأقل)',
                              ),
                              validator: (value) {
                                if (value == null || value.trim().length < 20) {
                                  return 'الوصف يجب أن يكون 20 حرفاً على الأقل';
                                }
                                if (value.trim().length > 1000) {
                                  return 'الوصف يجب ألا يتجاوز 1000 حرف';
                                }
                                return null;
                              },
                            ),
                            const SizedBox(height: 4),
                            Align(
                              alignment: Alignment.centerLeft,
                              child: Directionality(
                                textDirection: TextDirection.ltr,
                                child: Text(
                                  '${_descriptionController.text.length} / 1000',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: Color(0xFF7A6D5E),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 14),

                            // 4. الإحداثيات
                            _buildLabel('الإحداثيات'),
                            const SizedBox(height: 6),
                            Directionality(
                              textDirection: TextDirection.ltr,
                              child: Text(
                                '${widget.lat.toStringAsFixed(6)}, ${widget.lng.toStringAsFixed(6)}',
                                style: const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF221A14),
                                ),
                              ),
                            ),
                            const SizedBox(height: 16),

                            // 5. الصور
                            _buildLabel('الصور'),
                            const SizedBox(height: 6),
                            _buildPhotosSection(),
                            if (_photoError != null) ...[
                              const SizedBox(height: 4),
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 12),
                                child: Text(
                                  _photoError!,
                                  style: TextStyle(color: Colors.red.shade700, fontSize: 12),
                                ),
                              ),
                            ],
                            const SizedBox(height: 6),
                            const Text(
                              'من 1 إلى 10 صور، بحد أقصى 12 ميغابايت لكل صورة',
                              style: TextStyle(
                                fontSize: 12,
                                color: Color(0xFF7A6D5E),
                              ),
                            ),
                            const SizedBox(height: 24),

                            // Submit Button
                            SizedBox(
                              width: double.infinity,
                              height: 48,
                              child: FilledButton(
                                style: FilledButton.styleFrom(
                                  backgroundColor: const Color(0xFF9E5C0A),
                                  foregroundColor: Colors.white,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                ),
                                onPressed: isSubmitting ? null : _submit,
                                child: isSubmitting
                                    ? const SizedBox(
                                        width: 22,
                                        height: 22,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                        ),
                                      )
                                    : const Text(
                                        'إرسال المكان',
                                        style: TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                              ),
                            ),
                            const SizedBox(height: 32),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildLabel(String text) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w700,
        color: Color(0xFF221A14),
      ),
    );
  }

  InputDecoration _inputDecoration({required String hintText}) {
    return InputDecoration(
      hintText: hintText,
      hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF9E9284)),
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFE5DDD0)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFE5DDD0)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFF9E5C0A), width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(color: Colors.red.shade400),
      ),
    );
  }

  Widget _buildCategorySelector() {
    final selectedItem = MishwarConstants.placeCategories.firstWhere(
      (c) => c['key'] == _selectedCategory,
      orElse: () => {'label': 'اختر التصنيف'},
    );

    return PopupMenuButton<String>(
      onSelected: (key) {
        setState(() {
          _selectedCategory = key;
          _categoryError = null;
        });
      },
      position: PopupMenuPosition.under,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: Color(0xFFE5DDD0)),
      ),
      color: Colors.white,
      itemBuilder: (context) {
        return MishwarConstants.placeCategories.map((c) {
          final isSelected = c['key'] == _selectedCategory;
          return PopupMenuItem<String>(
            value: c['key'],
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: isSelected ? const Color(0xFFF3ECE1) : Colors.transparent,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Align(
                alignment: Alignment.centerRight,
                child: Text(
                  c['label']!,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                    color: const Color(0xFF221A14),
                  ),
                ),
              ),
            ),
          );
        }).toList();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: _categoryError != null ? Colors.red.shade400 : const Color(0xFFE5DDD0),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              selectedItem['label']!,
              style: TextStyle(
                fontSize: 14,
                color: _selectedCategory == null ? const Color(0xFF9E9284) : const Color(0xFF221A14),
                fontWeight: _selectedCategory == null ? FontWeight.normal : FontWeight.w600,
              ),
            ),
            const Icon(Icons.unfold_more, size: 20, color: Color(0xFF7A6D5E)),
          ],
        ),
      ),
    );
  }

  Widget _buildPhotosSection() {
    if (_selectedPhotos.isEmpty) {
      return InkWell(
        onTap: _pickPhotos,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          width: 110,
          height: 110,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE5DDD0)),
          ),
          child: const Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.add_photo_alternate_outlined, size: 32, color: Color(0xFF7A6D5E)),
              SizedBox(height: 8),
              Text(
                'إضافة صور',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF5A4D41),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return SizedBox(
      height: 110,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: _selectedPhotos.length < 10
            ? _selectedPhotos.length + 1
            : _selectedPhotos.length,
        separatorBuilder: (context, index) => const SizedBox(width: 10),
        itemBuilder: (context, index) {
          if (index == _selectedPhotos.length) {
            return InkWell(
              onTap: _pickPhotos,
              borderRadius: BorderRadius.circular(12),
              child: Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE5DDD0)),
                ),
                child: const Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.add_photo_alternate_outlined, size: 28, color: Color(0xFF7A6D5E)),
                    SizedBox(height: 4),
                    Text(
                      'إضافة المزيد',
                      style: TextStyle(fontSize: 11, color: Color(0xFF5A4D41)),
                    ),
                  ],
                ),
              ),
            );
          }

          final photo = _selectedPhotos[index];
          return Stack(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.file(
                  File(photo.path),
                  width: 100,
                  height: 100,
                  fit: BoxFit.cover,
                ),
              ),
              Positioned(
                top: 4,
                left: 4,
                child: GestureDetector(
                  onTap: () => _removePhoto(index),
                  child: Container(
                    decoration: const BoxDecoration(
                      color: Colors.black54,
                      shape: BoxShape.circle,
                    ),
                    padding: const EdgeInsets.all(4),
                    child: const Icon(Icons.close, size: 14, color: Colors.white),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
