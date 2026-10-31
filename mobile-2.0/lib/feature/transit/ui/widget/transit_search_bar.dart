import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:syrianzone/core/network/response/transit_search_response.dart';
import 'package:syrianzone/core/util/map_util.dart';
import 'package:syrianzone/feature/transit/logic/transit_cubit.dart';
import 'package:syrianzone/feature/transit/logic/transit_state.dart';

class TransitSearchBar extends StatefulWidget {
  final String cityId;
  final String? selectedRouteId;
  final ValueChanged<String> onRouteSelected;

  const TransitSearchBar({
    super.key,
    required this.cityId,
    required this.onRouteSelected,
    this.selectedRouteId,
  });

  @override
  State<TransitSearchBar> createState() => _TransitSearchBarState();
}

class _TransitSearchBarState extends State<TransitSearchBar> {
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _focusNode = FocusNode();
  Timer? _debounceTimer;
  bool _showResults = false;

  static const _borderColor = Color(0xFFC4862E);
  static const _textColor = Color(0xFF2F2722);
  static const _headerColor = Color(0xFF6B5E52);
  static const _pinColor = Color(0xFFBA7A18);
  static const _badgeBg = Color(0xFFEBE5DC);
  static const _selectedBg = Color(0xFFF1ECE4);
  static const _clearButtonBg = Color(0xFF7A7067);

  @override
  void initState() {
    super.initState();
    _searchController.addListener(_onTextChange);
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _searchController.removeListener(_onTextChange);
    _searchController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _onTextChange() {
    if (mounted) {
      setState(() {});
    }
  }

  void _onSearchChanged(String query) {
    _debounceTimer?.cancel();
    final trimmed = query.trim();
    if (trimmed.isEmpty) {
      setState(() {
        _showResults = false;
      });
      context.read<TransitCubit>().clearSearch();
      return;
    }

    setState(() {
      _showResults = true;
    });

    _debounceTimer = Timer(const Duration(milliseconds: 300), () {
      if (mounted && trimmed.isNotEmpty) {
        context.read<TransitCubit>().searchTransit(trimmed, widget.cityId);
      }
    });
  }

  void _clearSearch() {
    _debounceTimer?.cancel();
    _searchController.clear();
    setState(() {
      _showResults = false;
    });
    context.read<TransitCubit>().clearSearch();
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<TransitCubit, TransitState>(
      builder: (context, state) {
        final searchResults = state.searchResults;
        final hasResults = searchResults != null &&
            (searchResults.routes.isNotEmpty ||
                searchResults.stops.isNotEmpty);
        final hasError = state.searchErrorMessage != null;
        final showCard = _showResults &&
            _searchController.text.trim().isNotEmpty &&
            (hasResults || hasError || (!state.searchLoading && searchResults != null));

        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Search Input Field
            Container(
              height: 48,
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(30),
                border: Border.all(color: _borderColor, width: 1.5),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x18000000),
                    blurRadius: 8,
                    offset: Offset(0, 2),
                  ),
                ],
              ),
              child: Row(
                textDirection: TextDirection.rtl,
                children: [
                  const Icon(
                    Icons.search,
                    color: Color(0xFF5A4D41),
                    size: 24,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: _searchController,
                      focusNode: _focusNode,
                      onChanged: _onSearchChanged,
                      onTap: () {
                        if (_searchController.text.trim().isNotEmpty) {
                          setState(() {
                            _showResults = true;
                          });
                        }
                      },
                      
                      textAlign: TextAlign.right,
                      textDirection: TextDirection.rtl,
                      style: const TextStyle(
                        color: _textColor,
                        fontSize: 16,
                        fontWeight: FontWeight.w500,
                      ),
                      decoration: const InputDecoration(
                        isDense: true,
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        disabledBorder: InputBorder.none,
                        errorBorder: InputBorder.none,
                        focusedErrorBorder: InputBorder.none,
                        
                        contentPadding: EdgeInsets.zero,
                        hintText: 'ابحث عن خط أو موقف...',
                        hintStyle: TextStyle(
                          color: Color(0xFF8D7E6E),
                          fontSize: 15,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (state.searchLoading) ...[
                        const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor:
                                AlwaysStoppedAnimation<Color>(_borderColor),
                          ),
                        ),
                        if (_searchController.text.isNotEmpty)
                          const SizedBox(width: 8),
                      ],
                      if (_searchController.text.isNotEmpty)
                        GestureDetector(
                          onTap: _clearSearch,
                          child: Container(
                            width: 20,
                            height: 20,
                            decoration: const BoxDecoration(
                              color: _clearButtonBg,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.close,
                              size: 13,
                              color: Colors.white,
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),

            // Dropdown Results Card
            if (showCard) ...[
              const SizedBox(height: 8),
              Container(
                constraints: BoxConstraints(
                  maxHeight: MediaQuery.of(context).size.height * 0.45,
                ),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFE8E2D9)),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x18000000),
                      blurRadius: 14,
                      offset: Offset(0, 4),
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(20),
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 14,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (hasError)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            child: Text(
                              state.searchErrorMessage!,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                color: Colors.red,
                                fontSize: 14,
                              ),
                            ),
                          )
                        else if (!hasResults)
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 16),
                            child: Text(
                              'لا توجد نتائج مطابقة',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: _headerColor,
                                fontSize: 14,
                              ),
                            ),
                          )
                        else ...[
                          // Routes Section
                          if (searchResults.routes.isNotEmpty) ...[
                            _buildSectionHeader(
                              icon: Icons.directions_bus_outlined,
                              title: 'الخطوط',
                            ),
                            const SizedBox(height: 8),
                            ...searchResults.routes.map(
                              (route) => _buildRouteItem(route),
                            ),
                          ],

                          // Spacing between routes and stops if both exist
                          if (searchResults.routes.isNotEmpty &&
                              searchResults.stops.isNotEmpty)
                            const SizedBox(height: 18),

                          // Stops Section
                          if (searchResults.stops.isNotEmpty) ...[
                            _buildSectionHeader(
                              icon: Icons.location_on_outlined,
                              title: 'المواقف',
                            ),
                            const SizedBox(height: 8),
                            ...searchResults.stops.map(
                              (stop) => _buildStopItem(stop),
                            ),
                          ],
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ],
        );
      },
    );
  }

  Widget _buildSectionHeader({
    required IconData icon,
    required String title,
  }) {
    return Row(
      textDirection: TextDirection.rtl,
      children: [
        Icon(icon, size: 18, color: _headerColor),
        const SizedBox(width: 6),
        Text(
          title,
          style: const TextStyle(
            color: _headerColor,
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }

  Widget _buildRouteItem(TransitSearchRoute route) {
    final isSelected = widget.selectedRouteId == route.id;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          widget.onRouteSelected(route.id);
          setState(() {
            _showResults = false;
          });
          _focusNode.unfocus();
        },
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? _selectedBg : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            textDirection: TextDirection.rtl,
            children: [
              Expanded(
                child: Text(
                  route.nameAr,
                  textAlign: TextAlign.right,
                  textDirection: TextDirection.rtl,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: _textColor,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 3,
                ),
                decoration: BoxDecoration(
                  color: _badgeBg,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Text(
                  'خط',
                  style: TextStyle(
                    color: _textColor,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStopItem(TransitSearchStop stop) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          final coords = stop.coordinates;
          if (coords.length >= 2) {
            final lat = coords[1];
            final lng = coords[0];
            MapUtil.openMapApp(lat, lng, label: stop.nameAr);
          }
          setState(() {
            _showResults = false;
          });
          _focusNode.unfocus();
        },
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          child: Row(
            textDirection: TextDirection.rtl,
            children: [
              const Icon(
                Icons.location_on_outlined,
                size: 18,
                color: _pinColor,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  stop.nameAr,
                  textAlign: TextAlign.right,
                  textDirection: TextDirection.rtl,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: _textColor,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 3,
                ),
                decoration: BoxDecoration(
                  color: _badgeBg,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Text(
                  'موقف',
                  style: TextStyle(
                    color: _textColor,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
