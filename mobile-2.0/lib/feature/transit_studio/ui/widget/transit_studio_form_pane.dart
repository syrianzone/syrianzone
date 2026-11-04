import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:syrianzone/core/constants/route_palette.dart';
import 'package:syrianzone/core/network/response/city_response.dart';
import 'package:syrianzone/core/util/color_util.dart';
import 'package:syrianzone/feature/auth/logic/auth_cubit.dart';
import 'package:syrianzone/feature/auth/ui/auth_bottom_sheet.dart';
import 'package:syrianzone/feature/transit_studio/data/model/studio_tool_mode.dart';
import '../../logic/transit_studio_cubit.dart';
import '../../logic/transit_studio_state.dart';
import 'transit_studio_city_shimmer.dart';

class TransitStudioFormPane extends StatefulWidget {
  const TransitStudioFormPane({super.key});

  @override
  State<TransitStudioFormPane> createState() => _TransitStudioFormPaneState();
}

class _TransitStudioFormPaneState extends State<TransitStudioFormPane> {
  // Accordion controllers for smooth ExpansionTile animation
  final List<ExpansibleController> _sectionControllers =
      List.generate(6, (_) => ExpansibleController());

  int _expandedSection = 0; // 0: City, 1: Route, 2: Stops, 3: Color, 4: Info, 5: Submit

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        context.read<TransitStudioCubit>().nameArController.addListener(_onTextChanged);
      }
    });
  }

  void _onTextChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    try {
      context.read<TransitStudioCubit>().nameArController.removeListener(_onTextChanged);
    } catch (_) {}
    super.dispose();
  }

  void _expandSection(int index) {
    if (index < 0 || index >= _sectionControllers.length) return;
    setState(() {
      _expandedSection = index;
    });
    for (int i = 0; i < _sectionControllers.length; i++) {
      if (i == index) {
        if (!_sectionControllers[i].isExpanded) {
          _sectionControllers[i].expand();
        }
      } else {
        if (_sectionControllers[i].isExpanded) {
          _sectionControllers[i].collapse();
        }
      }
    }
  }

  Future<void> _confirmReset() async {
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

    if (confirmed == true && mounted) {
      context.read<TransitStudioCubit>().resetAll();
      _expandSection(0);
    }
  }

  Future<void> _showSubmitSuccessDialog(
    BuildContext context,
    String message,
  ) async {
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          title: const Row(
            children: [
              Icon(
                Icons.check_circle_rounded,
                color: Color(0xFF4B7F52),
                size: 26,
              ),
              SizedBox(width: 8),
              Text(
                'تم إرسال المسار بنجاح',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17),
              ),
            ],
          ),
          content: Text(
            message.isNotEmpty
                ? message
                : 'تم استلام المسار بنجاح للمراجعة والتدقيق.',
            style: const TextStyle(fontSize: 14, color: Color(0xFF2F2722)),
          ),
          actions: [
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF4B7F52),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 10,
                ),
              ),
              onPressed: () {
                Navigator.of(dialogContext).pop();
                if (context.mounted) {
                  Navigator.of(context).pop(true);
                }
              },
              child: const Text(
                'موافق',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<TransitStudioCubit, TransitStudioState>(
      listener: (context, state) {
        if (state.expandSectionIndex != null) {
          _expandSection(state.expandSectionIndex!);
        }

        if (state.errorMessage != null) {
          ScaffoldMessenger.of(context).hideCurrentSnackBar();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.errorMessage!),
              backgroundColor: const Color(0xFFB23A48),
            ),
          );
          context.read<TransitStudioCubit>().clearMessages();
        } else if (state.submitSuccess) {
          final message = state.successMessage ?? 'تم استلام المسار بنجاح!';
          context.read<TransitStudioCubit>().clearMessages();
          _showSubmitSuccessDialog(context, message);
        } else if (state.successMessage != null) {
          ScaffoldMessenger.of(context).hideCurrentSnackBar();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.successMessage!),
              backgroundColor: const Color(0xFF4B7F52),
            ),
          );
          context.read<TransitStudioCubit>().clearMessages();
        }
      },
      child: BlocBuilder<TransitStudioCubit, TransitStudioState>(
        builder: (context, state) {
          return Container(
            color: const Color(0xFFFAF8F5),
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              children: [
                _buildCityPickerSection(state),
                const SizedBox(height: 12),
                _buildRoadRouteSection(state),
                const SizedBox(height: 12),
                _buildStopsSection(state),
                const SizedBox(height: 12),
                _buildColorSection(state),
                const SizedBox(height: 12),
                _buildRouteInfoSection(state),
                const SizedBox(height: 12),
                _buildSubmitSection(state),
                const SizedBox(height: 24),
              ],
            ),
          );
        },
      ),
    );
  }

  // --- Accordion Card Wrapper using ExpansionTile for smooth animations ---
  Widget _buildAccordionCard({
    required int sectionIndex,
    required IconData icon,
    required String title,
    Widget? badge,
    required Widget child,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFFCFAF3),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE4D8C8)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0D000000),
            blurRadius: 4,
            offset: Offset(0, 2),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Theme(
        data: Theme.of(context).copyWith(
          dividerColor: Colors.transparent,
          splashColor: Colors.transparent,
          highlightColor: Colors.transparent,
        ),
        child: ExpansionTile(
          controller: _sectionControllers[sectionIndex],
          initiallyExpanded: _expandedSection == sectionIndex,
          shape: const Border(),
          collapsedShape: const Border(),
          tilePadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
          childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
          iconColor: const Color(0xFF85786E),
          collapsedIconColor: const Color(0xFF85786E),
          leading: Icon(icon, color: const Color(0xFFAB6D17), size: 20),
          title: Row(
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF2F2722),
                ),
              ),
              const Spacer(),
              ?badge,
            ],
          ),
          onExpansionChanged: (expanded) {
            if (expanded) {
              setState(() {
                _expandedSection = sectionIndex;
              });
              for (int i = 0; i < _sectionControllers.length; i++) {
                if (i != sectionIndex && _sectionControllers[i].isExpanded) {
                  _sectionControllers[i].collapse();
                }
              }
            } else if (_expandedSection == sectionIndex) {
              setState(() {
                _expandedSection = -1;
              });
            }
          },
          children: [
            const Divider(color: Color(0xFFE4D8C8), height: 1),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }

  Widget _buildStatusBadge({
    required String text,
    Color bg = const Color(0xFFF1EDE6),
    Color textColor = const Color(0xFF85786E),
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: textColor,
          fontSize: 11.5,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  // --- 1. City Picker Section ---
  Widget _buildCityPickerSection(TransitStudioState state) {
    final selectedCity = state.selectedCity;
    final cubit = context.read<TransitStudioCubit>();
    final hasError = state.citiesError != null ||
        (state.cities.isEmpty && selectedCity == null && !state.isLoadingCities);

    return _buildAccordionCard(
      sectionIndex: 0,
      icon: Icons.location_on_outlined,
      title: '1. اختر المدينة أولاً',
      badge: selectedCity != null
          ? _buildStatusBadge(
              text: '${selectedCity.routeCount} مسار منشور',
            )
          : null,
      child: state.isLoadingCities
          ? const TransitStudioCityShimmer()
          : hasError
              ? Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFDF2F2),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFF5C6CB)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          const Icon(
                            Icons.error_outline_rounded,
                            color: Color(0xFFB23A48),
                            size: 20,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              state.citiesError ??
                                  'تعذر تحميل بيانات المدن. يرجى التحقق من الاتصال والمحاولة مجدداً.',
                              style: const TextStyle(
                                fontSize: 13,
                                color: Color(0xFFB23A48),
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFB23A48),
                          foregroundColor: Colors.white,
                          elevation: 0,
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        onPressed: state.isSubmitting ? null : cubit.loadCities,
                        icon: const Icon(Icons.refresh_rounded, size: 18),
                        label: const Text(
                          'إعادة المحاولة',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ],
                  ),
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (selectedCity != null)
                      Container(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFE4D8C8)),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<CityResponse>(
                            value: selectedCity,
                            isExpanded: true,
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            icon: const Icon(
                              Icons.unfold_more_rounded,
                              color: Color(0xFF85786E),
                            ),
                            items: state.cities.map((city) {
                              return DropdownMenuItem<CityResponse>(
                                value: city,
                                child: Text(
                                  '${city.nameAr} (${city.routeCount} مسار)',
                                  style: const TextStyle(
                                    fontSize: 14.5,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF2F2722),
                                  ),
                                ),
                              );
                            }).toList(),
                            onChanged: state.isSubmitting
                                ? null
                                : (city) {
                                    if (city != null) {
                                      cubit.selectCity(city);
                                    }
                                  },
                          ),
                        ),
                      ),
                    const SizedBox(height: 8),
                    if (selectedCity != null)
                      Text(
                        'يتم ضبط نطاق الخريطة والتقريب تلقائياً على حدود مدينة ${selectedCity.nameAr}.',
                        style: const TextStyle(
                          fontSize: 11.5,
                          color: Color(0xFF85786E),
                        ),
                      ),
                  ],
                ),
    );
  }

  // --- 2. Road Route Tool Section ---
  Widget _buildRoadRouteSection(TransitStudioState state) {
    final isDone = state.roadPoints.length >= 2;
    final isDrawing = state.activeTool == StudioToolMode.drawRoad;
    final isMoving = state.activeTool == StudioToolMode.movePoint;
    final cubit = context.read<TransitStudioCubit>();

    return _buildAccordionCard(
      sectionIndex: 1,
      icon: Icons.alt_route_rounded,
      title: 'أداة رسم وتعديل المسار',
      badge: _buildStatusBadge(
        text: isDone ? '✓ مرسوم (${state.roadPoints.length} نقطة)' : 'لم يكتمل',
        bg: isDone ? const Color(0xFFE8F5E9) : const Color(0xFFF1EDE6),
        textColor: isDone ? const Color(0xFF2E7D32) : const Color(0xFF85786E),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'ارسم أو عدّل خط المسار على الخريطة. انقر على الخريطة لإضافة نقاط المسار، أو انقر على نقطة سابقة لنقلها.',
            style: TextStyle(fontSize: 12, color: Color(0xFF85786E)),
          ),
          const SizedBox(height: 10),

          // Move mode indicator banner in section
          if (isMoving && state.selectedPointIndex != null) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF3E0),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFFFB74D)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.pan_tool_rounded,
                      color: Color(0xFFE65100), size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '✋ جاري نقل النقطة ${state.selectedPointIndex! + 1}: انقر على الموقع الجديد في الخريطة.',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFFE65100),
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  TextButton(
                    onPressed: state.isSubmitting ? null : cubit.cancelMovePoint,
                    style: TextButton.styleFrom(
                      foregroundColor: const Color(0xFFE65100),
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: const Text('إلغاء'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
          ],

          if (isDone) ...[
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF7E6),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFF8DC99)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.warning_amber_rounded,
                      color: Color(0xFFAB6D17), size: 18),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'تأكد أن مسارك يختلف أو يكمل الخطوط الحالية للمدينة.',
                      style: TextStyle(
                        fontSize: 11.5,
                        color: Color(0xFFAB6D17),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
          ],

          // Toggle drawing mode button
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor:
                  isDrawing ? const Color(0xFFAB6D17) : const Color(0xFFF1EDE6),
              foregroundColor:
                  isDrawing ? Colors.white : const Color(0xFF2F2722),
              elevation: 0,
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: const BorderSide(color: Color(0xFFE4D8C8)),
              ),
            ),
            onPressed: state.isSubmitting
                ? null
                : () {
                    cubit.setToolMode(
                      isDrawing ? StudioToolMode.none : StudioToolMode.drawRoad,
                    );
                  },
            icon: Icon(
              isDrawing ? Icons.check_circle_outline : Icons.add_road_rounded,
              size: 20,
            ),
            label: Text(
              isDrawing
                  ? 'جاري رسم المسار... (انقر على الخريطة)'
                  : (isDone
                      ? '✓ تعديل وتمديد الخط (${state.roadPoints.length} نقطة)'
                      : 'ابدأ رسم المسار'),
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
          ),

          if (state.roadPoints.isNotEmpty) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF85786E),
                      side: const BorderSide(color: Color(0xFFE4D8C8)),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    onPressed: (state.isSubmitting || state.roadPoints.isEmpty)
                        ? null
                        : cubit.undoLastRoadPoint,
                    icon: const Icon(Icons.undo_rounded, size: 16),
                    label: const Text('تراجع عن نقطة', style: TextStyle(fontSize: 12)),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFFB23A48),
                      side: const BorderSide(color: Color(0xFFE4D8C8)),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    onPressed: (state.isSubmitting || state.roadPoints.isEmpty)
                        ? null
                        : cubit.clearRoadPoints,
                    icon: const Icon(Icons.refresh_rounded, size: 16),
                    label: const Text('إعادة رسم', style: TextStyle(fontSize: 12)),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  // --- 3. Stops Section ---
  Widget _buildStopsSection(TransitStudioState state) {
    final isAdding = state.activeTool == StudioToolMode.addStops;
    final cubit = context.read<TransitStudioCubit>();

    return _buildAccordionCard(
      sectionIndex: 2,
      icon: Icons.location_on_outlined,
      title: 'أداة مواقف الحافلات',
      badge: _buildStatusBadge(
        text: '${state.stops.length} محطة',
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'انقر على الخريطة لوضع محطات الحافلات. يمكنك كتابة اسم كل محطة وتعديلها بسهولة.',
            style: TextStyle(fontSize: 12, color: Color(0xFF85786E)),
          ),
          const SizedBox(height: 10),

          // Toggle add stop button
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor:
                  isAdding ? const Color(0xFFAB6D17) : const Color(0xFFF1EDE6),
              foregroundColor:
                  isAdding ? Colors.white : const Color(0xFF2F2722),
              elevation: 0,
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: const BorderSide(color: Color(0xFFE4D8C8)),
              ),
            ),
            onPressed: state.isSubmitting
                ? null
                : () {
                    cubit.setToolMode(
                      isAdding ? StudioToolMode.none : StudioToolMode.addStops,
                    );
                  },
            icon: const Icon(Icons.add_location_alt_outlined, size: 20),
            label: Text(
              isAdding
                  ? 'جاري وضع المحطات... انقر على الخريطة'
                  : 'إضافة محطات حافلات',
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(height: 12),

          if (state.stops.isEmpty)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: const Color(0xFFE4D8C8),
                  style: BorderStyle.solid,
                ),
              ),
              alignment: Alignment.center,
              child: const Text(
                'لم تضف أي محطات بعد.',
                style: TextStyle(color: Color(0xFF85786E), fontSize: 13),
              ),
            )
          else ...[
            Text(
              'المحطات المضافة (${state.stops.length}):',
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 13,
                color: Color(0xFF2F2722),
              ),
            ),
            const SizedBox(height: 8),
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: state.stops.length,
              separatorBuilder: (context, index) => const SizedBox(height: 6),
              itemBuilder: (context, index) {
                final stop = state.stops[index];
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: stop.hasError
                              ? const Color(0xFFB23A48)
                              : const Color(0xFFE4D8C8),
                          width: stop.hasError ? 1.5 : 1.0,
                        ),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 24,
                            height: 24,
                            decoration: BoxDecoration(
                              color: stop.hasError
                                  ? const Color(0xFFB23A48)
                                  : const Color(0xFFAB6D17),
                              shape: BoxShape.circle,
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              '${index + 1}',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: TextField(
                              controller: stop.controller,
                              enabled: !state.isSubmitting,
                              onChanged: (val) {
                                if (stop.hasError && val.trim().isNotEmpty) {
                                  setState(() {
                                    stop.hasError = false;
                                  });
                                }
                              },
                              decoration: const InputDecoration(
                                hintText: 'اسم المحطة (مطلوب)...',
                                hintStyle: TextStyle(
                                  color: Color(0xFF9E9E9E),
                                  fontSize: 13,
                                ),
                                border: InputBorder.none,
                                isDense: true,
                                contentPadding: EdgeInsets.symmetric(vertical: 6),
                              ),
                              style: const TextStyle(fontSize: 13),
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.delete_outline_rounded,
                                color: Color(0xFF85786E), size: 20),
                            onPressed: state.isSubmitting
                                ? null
                                : () => cubit.removeStop(index),
                            tooltip: 'حذف المحطة',
                          ),
                        ],
                      ),
                    ),
                    if (stop.hasError)
                      const Padding(
                        padding: EdgeInsets.only(top: 4, right: 6),
                        child: Text(
                          'يرجى إدخال اسم المحطة',
                          style: TextStyle(
                            color: Color(0xFFB23A48),
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                  ],
                );
              },
            ),
          ],
        ],
      ),
    );
  }

  // --- 4. Road (Line Color) Section ---
  Widget _buildColorSection(TransitStudioState state) {
    final cubit = context.read<TransitStudioCubit>();

    return _buildAccordionCard(
      sectionIndex: 3,
      icon: Icons.palette_outlined,
      title: 'لون خط المسار',
      badge: Container(
        width: 18,
        height: 18,
        decoration: BoxDecoration(
          color: state.currentColor,
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white, width: 2),
          boxShadow: const [
            BoxShadow(color: Color(0x22000000), blurRadius: 2),
          ],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'اختر لون المسار للظهور على الخريطة وتمييزه عن باقي الخطوط:',
            style: TextStyle(fontSize: 12, color: Color(0xFF85786E)),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 12,
            runSpacing: 10,
            alignment: WrapAlignment.center,
            children: List.generate(RoutePalette.colors.length, (index) {
              final color = ColorUtil.hexToColor(RoutePalette.colors[index]);
              final isSelected = state.selectedColorIndex == index;

              return GestureDetector(
                onTap: state.isSubmitting
                    ? null
                    : () => cubit.setSelectedColorIndex(index),
                child: Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: color,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: isSelected ? Colors.black : Colors.transparent,
                      width: 2.5,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: color.withValues(alpha: 0.35),
                        blurRadius: 4,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: isSelected
                      ? const Icon(Icons.check, color: Colors.white, size: 18)
                      : null,
                ),
              );
            }),
          ),
        ],
      ),
    );
  }

  // --- 5. Route Info Section ---
  Widget _buildRouteInfoSection(TransitStudioState state) {
    final cubit = context.read<TransitStudioCubit>();

    return _buildAccordionCard(
      sectionIndex: 4,
      icon: Icons.info_outline_rounded,
      title: 'معلومات المسار',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: cubit.nameArController,
            enabled: !state.isSubmitting,
            decoration: const InputDecoration(
              labelText: 'اسم المسار (بالعربية) *',
              hintText: 'مثال: الدوار الشمالي - الكراجات',
              hintStyle: TextStyle(color: Color(0xFF9E9E9E)),
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: cubit.nameEnController,
            enabled: !state.isSubmitting,
            decoration: const InputDecoration(
              labelText: 'اسم المسار (بالإنجليزية - اختياري)',
              hintText: 'e.g. North Ring - Bus Terminal',
              hintStyle: TextStyle(color: Color(0xFF9E9E9E)),
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: cubit.priceController,
            enabled: !state.isSubmitting,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              labelText: 'التسعيرة (ل.س)',
              hintText: 'مثال: 1500',
              hintStyle: TextStyle(color: Color(0xFF9E9E9E)),
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: cubit.notesController,
            enabled: !state.isSubmitting,
            maxLines: 2,
            decoration: const InputDecoration(
              labelText: 'ملاحظات إضافية (اختياري)',
              hintText: 'أي تفاصيل أخرى حول ساعات العمل، التردد، إلخ...',
              hintStyle: TextStyle(color: Color(0xFF9E9E9E)),
            ),
          ),
        ],
      ),
    );
  }

  // --- 6. Submit Section (Accordion) ---
  Widget _buildSubmitSection(TransitStudioState state) {
    final cubit = context.read<TransitStudioCubit>();
    final user = context.watch<AuthCubit>().currentUser;

    final hasValidStops = state.stops.isEmpty ||
        state.stops.every((s) => s.controller.text.trim().isNotEmpty);
    final isReady = state.selectedCity != null &&
        state.roadPoints.length >= 2 &&
        cubit.nameArController.text.trim().isNotEmpty &&
        hasValidStops;

    return _buildAccordionCard(
      sectionIndex: 5,
      icon: Icons.near_me_outlined,
      title: 'إرسال المسودة والتسليم',
      badge: _buildStatusBadge(
        text: isReady ? 'جاهز' : 'غير مكتمل',
        bg: isReady ? const Color(0xFFF1EDE6) : const Color(0xFFFDF0F0),
        textColor: isReady ? const Color(0xFF5E544A) : const Color(0xFFB23A48),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 1. Summary box matching screenshot
          Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE4D8C8)),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Column(
              children: [
                _buildSummaryRow('المدينة:', state.selectedCity?.nameAr ?? '—'),
                const SizedBox(height: 8),
                _buildSummaryRow(
                  'اسم المسار:',
                  cubit.nameArController.text.trim().isNotEmpty
                      ? cubit.nameArController.text.trim()
                      : '—',
                ),
                const SizedBox(height: 8),
                _buildSummaryRow('نقاط الخط:', '${state.roadPoints.length} نقطة'),
                const SizedBox(height: 8),
                _buildSummaryRow('عدد المحطات:', '${state.stops.length} محطة'),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // 2. Auth user badge or guest prompt
          if (user != null) ...[
            Container(
              decoration: BoxDecoration(
                color: const Color(0xFFF7F2EB),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE4D8C8)),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              child: Row(
                children: [
                  const Icon(
                    Icons.person_outline_rounded,
                    size: 20,
                    color: Color(0xFF9E5A0B),
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'مسجل باسم: ',
                    style: TextStyle(
                      color: Color(0xFF9E5A0B),
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                    ),
                  ),
                  Expanded(
                    child: Text(
                      user.name ?? 'مستخدم',
                      style: const TextStyle(
                        color: Color(0xFF2F2722),
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF9E5A0B),
                foregroundColor: Colors.white,
                disabledBackgroundColor:
                    const Color(0xFF9E5A0B).withValues(alpha: 0.65),
                disabledForegroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              onPressed: (state.isSubmitting || !isReady)
                  ? null
                  : () => cubit.validateAndSubmit(),
              child: state.isSubmitting
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.2,
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                      ),
                    )
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.near_me_outlined, size: 20),
                        const SizedBox(width: 8),
                        Text(
                          state.editingDraftId != null
                              ? 'حفظ التعديلات باسمي'
                              : 'إرسال المسودة باسمي',
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
            ),
          ] else ...[
            // Guest mode: Provide both options as requested
            Container(
              decoration: BoxDecoration(
                color: const Color(0xFFF7F2EB),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE4D8C8)),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              child: const Row(
                children: [
                  Icon(
                    Icons.info_outline_rounded,
                    size: 18,
                    color: Color(0xFF9E5A0B),
                  ),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                     "يمكنك إرسال المسودة فوراً كزائر (مجهول)، أو تسجيل الدخول بحساب Google لتُنسب المساهمة لك وتتمكن من متابعة وتعديل المسار لاحقاً.",
                      style: TextStyle(
                        color: Color(0xFF85786E),
                        fontSize: 12,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF9E5A0B),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              onPressed: (state.isSubmitting || !isReady)
                  ? null
                  : () async {
                      final loggedIn = await AuthBottomSheet.show(context);
                      if (loggedIn && context.mounted) {
                        cubit.validateAndSubmit();
                      }
                    },
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.login_rounded, size: 18),
                  SizedBox(width: 8),
                  Text(
                    'تسجيل الدخول والإرسال باسمي',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            OutlinedButton(
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF5E544A),
                side: const BorderSide(color: Color(0xFFE4D8C8)),
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              onPressed: (state.isSubmitting || !isReady)
                  ? null
                  : () => cubit.validateAndSubmit(),
              child: state.isSubmitting
                  ? const SizedBox(
                      height: 18,
                      width: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text(
                      'إرسال المسار كزائر',
                      style:
                          TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                    ),
            ),
          ],
          const SizedBox(height: 8),
          Center(
            child: TextButton(
              onPressed: state.isSubmitting ? null : _confirmReset,
              child: const Text(
                'إعادة ضبط المسودة',
                style: TextStyle(
                  color: Color(0xFF85786E),
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 13,
            color: Color(0xFF85786E),
          ),
        ),
        Text(
          value,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.bold,
            color: Color(0xFF2F2722),
          ),
        ),
      ],
    );
  }
}
