import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:syrianzone/core/network/response/places_response.dart';
import 'package:syrianzone/feature/mishwar/logic/mishwar_cubit.dart';
import 'package:syrianzone/feature/mishwar/logic/mishwar_state.dart';
import 'package:syrianzone/feature/mishwar/constants/mishwar_constants.dart';

class MishwarSearchBar extends StatefulWidget {
  final ValueChanged<PlaceResponse> onPlaceSelected;
  final bool isGalleryMode;
  final ValueChanged<bool>? onViewModeChanged;
  final VoidCallback? onOpenFilter;
  final String activeFilterLabel;
  final bool hasActiveFilter;

  const MishwarSearchBar({
    super.key,
    required this.onPlaceSelected,
    this.isGalleryMode = false,
    this.onViewModeChanged,
    this.onOpenFilter,
    this.activeFilterLabel = 'تصفية',
    this.hasActiveFilter = false,
  });

  @override
  State<MishwarSearchBar> createState() => _MishwarSearchBarState();
}

class _MishwarSearchBarState extends State<MishwarSearchBar> {
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocusNode = FocusNode();
  bool _showSearchResults = false;
  bool _isExpanded = false;

  @override
  void initState() {
    super.initState();
    _searchFocusNode.addListener(_handleFocusChange);
  }

  void _handleFocusChange() {
    if (_searchFocusNode.hasFocus) {
      if (!_isExpanded) {
        setState(() {
          _isExpanded = true;
          if (_searchController.text.trim().isNotEmpty) {
            _showSearchResults = true;
          }
        });
      }
    } else {
      if (_searchController.text.trim().isEmpty && _isExpanded) {
        setState(() {
          _isExpanded = false;
          _showSearchResults = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _searchFocusNode.removeListener(_handleFocusChange);
    _searchController.dispose();
    _searchFocusNode.dispose();
    super.dispose();
  }

  void _closeOrClearSearch() {
    if (_searchController.text.isNotEmpty) {
      _searchController.clear();
      setState(() {
        _showSearchResults = false;
      });
      context.read<MishwarCubit>().clearPlacesSearch();
    } else {
      setState(() {
        _isExpanded = false;
        _showSearchResults = false;
      });
      _searchFocusNode.unfocus();
    }
  }

  void _closeSearch() {
    _searchController.clear();
    _searchFocusNode.unfocus();
    setState(() {
      _isExpanded = false;
      _showSearchResults = false;
    });
    context.read<MishwarCubit>().clearPlacesSearch();
  }

  @override
  Widget build(BuildContext context) {
    final isSearchOpen = _isExpanded ||
        _searchFocusNode.hasFocus ||
        _showSearchResults ||
        _searchController.text.isNotEmpty;

    return PopScope(
      canPop: !isSearchOpen,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        if (isSearchOpen) {
          _closeSearch();
        }
      },
      child: BlocBuilder<MishwarCubit, MishwarState>(
      buildWhen: (prev, curr) =>
          prev.isSearching != curr.isSearching ||
          prev.searchResults != curr.searchResults ||
          prev.searchError != curr.searchError,
      builder: (context, state) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Top Action Row: Search input (right), Filter chip (center), View mode capsule (left)
              Row(
                children: [
                  // 1. Search Bar (animates to 100% full width when active)
                  Expanded(
                    child: _buildSearchInput(state),
                  ),

                  // 2. Filter Chip & Mode Capsule (smoothly collapse to 0 width when search expands)
                  ClipRect(
                    child: AnimatedSize(
                      duration: const Duration(milliseconds: 250),
                      curve: Curves.easeInOutCubic,
                      child: _isExpanded
                          ? const SizedBox.shrink()
                          : Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const SizedBox(width: 8),
                                _buildFilterChip(),
                                const SizedBox(width: 8),
                                _buildModeCapsule(),
                              ],
                            ),
                    ),
                  ),
                ],
              ),

              // Dropdown Results Card - Stretches to FULL WIDTH of parent!
              if (_showSearchResults && _searchController.text.trim().isNotEmpty) ...[
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
                        color: Color(0x22000000),
                        blurRadius: 14,
                        offset: Offset(0, 4),
                      ),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(20),
                    child: state.isSearching && state.searchResults.isEmpty
                        ? const Padding(
                            padding: EdgeInsets.symmetric(vertical: 24),
                            child: Center(
                              child: SizedBox(
                                width: 24,
                                height: 24,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF965B0E)),
                                ),
                              ),
                            ),
                          )
                        : state.searchError != null && state.searchResults.isEmpty
                            ? Padding(
                                padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
                                child: Center(
                                  child: Text(
                                    state.searchError!,
                                    textAlign: TextAlign.center,
                                    style: const TextStyle(
                                      color: Colors.red,
                                      fontSize: 13,
                                    ),
                                  ),
                                ),
                              )
                            : state.searchResults.isEmpty
                                ? const Padding(
                                    padding: EdgeInsets.symmetric(vertical: 20, horizontal: 16),
                                    child: Center(
                                      child: Text(
                                        'لا توجد نتائج مطابقة',
                                        textAlign: TextAlign.center,
                                        style: TextStyle(
                                          color: Color(0xFF6B5E52),
                                          fontSize: 14,
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                    ),
                                  )
                                : ListView.separated(
                                    shrinkWrap: true,
                                    physics: const ClampingScrollPhysics(),
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                                    itemCount: state.searchResults.length,
                                    separatorBuilder: (context, index) => const Divider(
                                      height: 1,
                                      thickness: 0.5,
                                      color: Color(0xFFF0EBE1),
                                    ),
                                    itemBuilder: (context, index) {
                                      final place = state.searchResults[index];
                                      return _buildPlaceSearchItem(context, place);
                                    },
                                  ),
                  ),
                ),
              ],
            ],
          ),
        );
      },
    ),
    );
  }

  Widget _buildSearchInput(MishwarState state) {
    return Container(
      height: 42,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: _isExpanded ? const Color(0xFF965B0E) : const Color(0xFFE5DDD0),
          width: _isExpanded ? 1.4 : 1.0,
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x14000000),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          const SizedBox(width: 10),
          const Icon(Icons.search, size: 18, color: Color(0xFF8D7E6E)),
          const SizedBox(width: 6),
          Expanded(
            child: TextField(
              controller: _searchController,
              focusNode: _searchFocusNode,
              onChanged: (val) {
                final trimmed = val.trim();
                if (trimmed.isEmpty) {
                  setState(() {
                    _showSearchResults = false;
                  });
                  context.read<MishwarCubit>().clearPlacesSearch();
                } else {
                  setState(() {
                    _showSearchResults = true;
                  });
                  context.read<MishwarCubit>().searchPlaces(trimmed);
                }
              },
              onTap: () {
                setState(() {
                  _isExpanded = true;
                  if (_searchController.text.trim().isNotEmpty) {
                    _showSearchResults = true;
                  }
                });
              },
              style: const TextStyle(fontSize: 13, color: Color(0xFF2F2722)),
              decoration: InputDecoration(
                hintText: _isExpanded ? 'ابحث في الأماكن (الاسم، الوصف...)' : 'ابحث عن مكان...',
                hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF9E9284)),
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                disabledBorder: InputBorder.none,
                errorBorder: InputBorder.none,
                focusedErrorBorder: InputBorder.none,
                filled: false,
                fillColor: Colors.transparent,
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(vertical: 10),
              ),
            ),
          ),
          if (state.isSearching && _searchController.text.trim().isNotEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 6),
              child: SizedBox(
                width: 14,
                height: 14,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF965B0E)),
                ),
              ),
            ),
          if (_isExpanded || _searchController.text.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.close, size: 16, color: Color(0xFF8D7E6E)),
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
              onPressed: _closeOrClearSearch,
            ),
          const SizedBox(width: 4),
        ],
      ),
    );
  }

  Widget _buildFilterChip() {
    return InkWell(
      onTap: widget.onOpenFilter,
      borderRadius: BorderRadius.circular(24),
      child: Container(
        height: 42,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
            color: widget.hasActiveFilter
                ? const Color(0xFF965B0E)
                : const Color(0xFFE5DDD0),
            width: widget.hasActiveFilter ? 1.4 : 1.0,
          ),
          boxShadow: const [
            BoxShadow(
              color: Color(0x14000000),
              blurRadius: 8,
              offset: Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              widget.activeFilterLabel,
              style: TextStyle(
                color: widget.hasActiveFilter
                    ? const Color(0xFF965B0E)
                    : const Color(0xFF4A3E34),
                fontSize: 13,
                fontWeight: widget.hasActiveFilter ? FontWeight.w700 : FontWeight.w600,
              ),
            ),
            const SizedBox(width: 5),
            Icon(
              Icons.tune_rounded,
              size: 16,
              color: widget.hasActiveFilter
                  ? const Color(0xFF965B0E)
                  : const Color(0xFF6D6054),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildModeCapsule() {
    return Container(
      height: 42,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFE5DDD0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x14000000),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildModeButton(
            title: 'خريطة',
            icon: Icons.map_outlined,
            isActive: !widget.isGalleryMode,
            onTap: () => widget.onViewModeChanged?.call(false),
          ),
          _buildModeButton(
            title: 'معرض',
            icon: Icons.grid_view_rounded,
            isActive: widget.isGalleryMode,
            onTap: () => widget.onViewModeChanged?.call(true),
          ),
        ],
      ),
    );
  }

  Widget _buildModeButton({
    required String title,
    required IconData icon,
    required bool isActive,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: isActive ? const Color(0xFF965B0E) : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              title,
              style: TextStyle(
                color: isActive ? Colors.white : const Color(0xFF6D6054),
                fontSize: 13,
                fontWeight: isActive ? FontWeight.w700 : FontWeight.w600,
              ),
            ),
            const SizedBox(width: 4),
            Icon(
              icon,
              size: 16,
              color: isActive ? Colors.white : const Color(0xFF6D6054),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlaceSearchItem(BuildContext context, PlaceResponse place) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          _searchController.clear();
          setState(() {
            _showSearchResults = false;
            _isExpanded = false;
          });
          _searchFocusNode.unfocus();
          context.read<MishwarCubit>().clearPlacesSearch();
          widget.onPlaceSelected(place);
        },
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          child: Row(
            textDirection: TextDirection.rtl,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  width: 44,
                  height: 44,
                  color: const Color(0xFFF0EBE1),
                  child: place.thumbUrl != null && place.thumbUrl!.isNotEmpty
                      ? Image.network(
                          place.thumbUrl!,
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stackTrace) =>
                              const Icon(Icons.image_not_supported_outlined, size: 20, color: Color(0xFFB5A99B)),
                        )
                      : const Icon(Icons.place_outlined, size: 22, color: Color(0xFF965B0E)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      place.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.right,
                      style: const TextStyle(
                        color: Color(0xFF2F2722),
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      MishwarConstants.getCategoryLabel(place.category),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.right,
                      style: const TextStyle(
                        color: Color(0xFF8D7E6E),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              if (place.savesCount > 0)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF9F6F0),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: const Color(0xFFE5DDD0)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.bookmark_outline, size: 12, color: Color(0xFF965B0E)),
                      const SizedBox(width: 2),
                      Text(
                        '${place.savesCount}',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF965B0E),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
