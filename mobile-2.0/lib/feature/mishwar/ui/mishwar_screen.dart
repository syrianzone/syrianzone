import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:syrianzone/core/constants/map_constants.dart';
import 'package:syrianzone/core/data/model/map_feature_item.dart';
import 'package:syrianzone/core/network/response/hotels_map_response.dart';
import 'package:syrianzone/core/network/response/places_map_response.dart';
import 'package:syrianzone/feature/auth/ui/auth_bottom_sheet.dart';
import 'package:syrianzone/feature/mishwar/constants/mishwar_constants.dart';
import 'package:syrianzone/feature/mishwar/logic/mishwar_cubit.dart';
import 'package:syrianzone/feature/mishwar/logic/mishwar_state.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/common/mishwar_filter_bottom_sheet.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/common/mishwar_gallery_view.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/common/mishwar_search_bar.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/common/mishwar_sheet_constants.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/guide/mishwar_guides_tab.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/hotel/hotel_detail_bottom_sheet.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/hotel/mishwar_hotels_tab.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/map/mishwar_map_pane.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/place/add_place_bottom_sheet.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/place/mishwar_contributions_tab.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/place/mishwar_places_tab.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/place/mishwar_saved_places_tab.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/place/place_detail_bottom_sheet.dart';

class MishwarScreen extends StatefulWidget {
  const MishwarScreen({super.key});

  @override
  State<MishwarScreen> createState() => _MishwarScreenState();
}

class _MishwarScreenState extends State<MishwarScreen> with TickerProviderStateMixin {
  late TabController _tabController;
  double _sheetFraction = MishwarSheetConstants.collapsedFraction;
  late final AnimationController _sheetAnimController;
  Animation<double>? _sheetAnimation;
  final GlobalKey<MishwarMapPaneState> _mapPaneKey = GlobalKey<MishwarMapPaneState>();

  bool _isGalleryMode = false;
  bool _hasEverOpenedGallery = false;
  String _typeFilter = 'all'; // 'all', 'places', 'hotels'

  List<MapFeatureItem>? _cachedMapFeatures;
  List<PlaceMapFeature>? _lastMapPlaces;
  List<HotelMapFeature>? _lastMapHotels;
  String? _lastTypeFilter;
  int? _lastSelectedTabIndex;
  int? _lastFilterUserId;

  @override
  void initState() {
    super.initState();
    _sheetAnimController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 250),
    )..addListener(() {
        if (_sheetAnimation != null) {
          setState(() {
            _sheetFraction = _sheetAnimation!.value;
          });
        }
      });
    final isLoggedIn = context.read<MishwarCubit>().state.isLoggedIn;
    _tabController = TabController(length: isLoggedIn ? 5 : 3, vsync: this);
    _tabController.addListener(_onTabChanged);
  }

  void _onTabChanged() {
    if (_tabController.indexIsChanging) return;
    context.read<MishwarCubit>().setTab(_tabController.index);
  }

  void _ensureTabController(bool isLoggedIn) {
    final targetLength = isLoggedIn ? 5 : 3;
    if (_tabController.length != targetLength) {
      _tabController.removeListener(_onTabChanged);
      _tabController.dispose();
      _tabController = TabController(length: targetLength, vsync: this);
      _tabController.addListener(_onTabChanged);
    }
  }

  @override
  void dispose() {
    _sheetAnimController.dispose();
    _tabController.removeListener(_onTabChanged);
    _tabController.dispose();
    super.dispose();
  }

  void _animateSheetTo(double target) {
    _sheetAnimController.stop();
    _sheetAnimation = Tween<double>(begin: _sheetFraction, end: target).animate(
      CurvedAnimation(parent: _sheetAnimController, curve: Curves.easeOutCubic),
    );
    _sheetAnimController.forward(from: 0);
  }

  List<MapFeatureItem> _getMapFeatures(MishwarState state) {
    if (_cachedMapFeatures != null &&
        identical(_lastMapPlaces, state.mapPlaces) &&
        identical(_lastMapHotels, state.mapHotels) &&
        _lastTypeFilter == _typeFilter &&
        _lastSelectedTabIndex == state.selectedTabIndex &&
        _lastFilterUserId == state.filterUserId) {
      return _cachedMapFeatures!;
    }

    _lastMapPlaces = state.mapPlaces;
    _lastMapHotels = state.mapHotels;
    _lastTypeFilter = _typeFilter;
    _lastSelectedTabIndex = state.selectedTabIndex;
    _lastFilterUserId = state.filterUserId;

    List<MapFeatureItem> rawMapFeatures;
    if (_typeFilter == 'hotels') {
      rawMapFeatures = state.mapHotels;
    } else if (_typeFilter == 'places') {
      rawMapFeatures = state.mapPlaces;
    } else {
      rawMapFeatures = [...state.mapPlaces, ...state.mapHotels];
    }

    _cachedMapFeatures = (state.selectedTabIndex != 1 && state.filterUserId != null)
        ? rawMapFeatures.where((f) => f.userId == state.filterUserId).toList()
        : rawMapFeatures;

    return _cachedMapFeatures!;
  }

  void _snapToClosestFraction([double? velocity]) {
    double target;

    if (velocity != null && velocity.abs() > 300) {
      if (velocity < 0) {
        // Swiped UP -> expand
        if (_sheetFraction < MishwarSheetConstants.swipeUpThreshold) {
          target = MishwarSheetConstants.midFraction;
        } else {
          target = MishwarSheetConstants.maxFraction;
        }
      } else {
        // Swiped DOWN -> collapse
        if (_sheetFraction > MishwarSheetConstants.swipeDownThreshold) {
          target = MishwarSheetConstants.midFraction;
        } else {
          target = MishwarSheetConstants.collapsedFraction;
        }
      }
    } else {
      target = MishwarSheetConstants.snapPoints.reduce(
        (a, b) => (_sheetFraction - a).abs() < (_sheetFraction - b).abs() ? a : b,
      );
    }
    _animateSheetTo(target);
  }

  Future<void> _showLoginPrompt(BuildContext context) async {
    final success = await AuthBottomSheet.show(context);
    if (success && context.mounted) {
      context.read<MishwarCubit>().startLocationPicker();
    }
  }

  void _openPlaceDetail({
    required int placeId,
    required double lat,
    required double lng,
    String? name,
    String? category,
  }) {
    context.read<MishwarCubit>().highlightPlace(placeId);
    _animateSheetTo(MishwarSheetConstants.collapsedFraction);
    _mapPaneKey.currentState?.zoomToLocation(lat, lng);
    PlaceDetailBottomSheet.show(
      context,
      placeId: placeId,
      initialName: name,
      initialCategory: category,
    );
  }

  void _openHotelDetail({
    required int hotelId,
    double? lat,
    double? lng,
    String? name,
  }) {
    context.read<MishwarCubit>().highlightHotel(hotelId);
    _animateSheetTo(MishwarSheetConstants.collapsedFraction);
    if (lat != null && lng != null) {
      _mapPaneKey.currentState?.zoomToLocation(lat, lng);
    }
    HotelDetailBottomSheet.show(
      context,
      hotelId: hotelId,
      initialName: name,
    );
  }

  void _openFilterBottomSheet(BuildContext context, MishwarState state) {
    MishwarFilterBottomSheet.show(
      context,
      selectedType: _typeFilter,
      selectedCategory: state.selectedCategory,
      onTypeChanged: (type) {
        setState(() {
          _typeFilter = type;
        });
        if (type == 'places') {
          if (_tabController.index != 0) {
            _tabController.animateTo(0);
            context.read<MishwarCubit>().setTab(0);
          }
        } else if (type == 'hotels') {
          if (_tabController.index != 1) {
            _tabController.animateTo(1);
            context.read<MishwarCubit>().setTab(1);
          }
        }
      },
      onCategoryChanged: (category) {
        context.read<MishwarCubit>().filterCategory(category);
        if (category != null && _tabController.index != 0) {
          _tabController.animateTo(0);
          context.read<MishwarCubit>().setTab(0);
        }
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<MishwarCubit, MishwarState>(
      listenWhen: (prev, curr) =>
          (prev.filterUserId != curr.filterUserId && curr.filterUserId != null) ||
          (!prev.isPickingLocation && curr.isPickingLocation),
      listener: (context, state) {
        if (state.isPickingLocation) {
          _animateSheetTo(MishwarSheetConstants.collapsedFraction);
        } else if (state.filterUserId != null) {
          // Animate to Places tab
          if (_tabController.index != 0) {
            _tabController.animateTo(0);
          }
        }
      },
      builder: (context, state) {
        _ensureTabController(state.isLoggedIn);

        final mapFeatures = _getMapFeatures(state);

        String activeFilterLabel = 'تصفية';
        bool hasActiveFilter = false;
        if (state.selectedCategory != null) {
          activeFilterLabel = MishwarConstants.getCategoryLabel(state.selectedCategory);
          hasActiveFilter = true;
        } else if (_typeFilter == 'hotels') {
          activeFilterLabel = 'فنادق';
          hasActiveFilter = true;
        } else if (_typeFilter == 'places') {
          activeFilterLabel = 'أماكن';
          hasActiveFilter = true;
        }

        final tabs = state.isLoggedIn
            ? const [
                Tab(text: 'الأماكن'),
                Tab(text: 'الفنادق'),
                Tab(text: 'محفوظاتي'),
                Tab(text: 'مساهماتي'),
                Tab(text: 'مرشدون'),
              ]
            : const [
                Tab(text: 'الأماكن'),
                Tab(text: 'الفنادق'),
                Tab(text: 'مرشدون'),
              ];

        final tabViews = state.isLoggedIn
            ? [
                MishwarPlacesTab(
                  onPlaceTap: (place) {
                    _openPlaceDetail(
                      placeId: place.id,
                      lat: place.lat,
                      lng: place.lng,
                      name: place.name,
                      category: place.category,
                    );
                  },
                ),
                MishwarHotelsTab(
                  onHotelTap: (hotel) {
                    _openHotelDetail(
                      hotelId: hotel.id,
                      lat: hotel.lat,
                      lng: hotel.lng,
                      name: hotel.displayName,
                    );
                  },
                ),
                MishwarSavedPlacesTab(
                  onPlaceTap: (place) {
                    _openPlaceDetail(
                      placeId: place.id,
                      lat: place.lat,
                      lng: place.lng,
                      name: place.name,
                      category: place.category,
                    );
                  },
                ),
                MishwarContributionsTab(
                  onPlaceTap: (place) {
                    _openPlaceDetail(
                      placeId: place.id,
                      lat: place.lat,
                      lng: place.lng,
                      name: place.name,
                      category: place.category,
                    );
                  },
                  onAddPlace: () => context.read<MishwarCubit>().startLocationPicker(),
                ),
                MishwarGuidesTab(
                  onShowGuideOnMap: (guide) {
                    context.read<MishwarCubit>().filterByUser(guide.userId, guide.name);
                    _tabController.animateTo(0);
                  },
                ),
              ]
            : [
                MishwarPlacesTab(
                  onPlaceTap: (place) {
                    _openPlaceDetail(
                      placeId: place.id,
                      lat: place.lat,
                      lng: place.lng,
                      name: place.name,
                      category: place.category,
                    );
                  },
                ),
                MishwarHotelsTab(
                  onHotelTap: (hotel) {
                    _openHotelDetail(
                      hotelId: hotel.id,
                      lat: hotel.lat,
                      lng: hotel.lng,
                      name: hotel.displayName,
                    );
                  },
                ),
                MishwarGuidesTab(
                  onShowGuideOnMap: (guide) {
                    context.read<MishwarCubit>().filterByUser(guide.userId, guide.name);
                    _tabController.animateTo(0);
                  },
                ),
              ];

        final isSheetExpanded = !_isGalleryMode &&
            _sheetFraction > (MishwarSheetConstants.collapsedFraction + 0.01);

        return PopScope<void>(
          canPop: !isSheetExpanded,
          onPopInvokedWithResult: (didPop, _) {
            if (!didPop && isSheetExpanded) {
              _animateSheetTo(MishwarSheetConstants.collapsedFraction);
            }
          },
          child: Scaffold(
            resizeToAvoidBottomInset: false, // Prevents layout from resizing for the keyboard

          appBar: AppBar(
            title: const Text(
              'مشوار',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
            centerTitle: true,
          ),
          floatingActionButton: (state.isPickingLocation || _isGalleryMode)
              ? null
              : SizedBox(
                  height: 38,
                  child: FloatingActionButton.extended(
                    backgroundColor: const Color(0xFF965B0E),
                    foregroundColor: Colors.white,
                    elevation: 3,
                    highlightElevation: 5,
                    shape: const StadiumBorder(),
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    extendedPadding: const EdgeInsets.symmetric(horizontal: 14),
                    onPressed: () {
                      if (!state.isLoggedIn) {
                        _showLoginPrompt(context);
                      } else {
                        context.read<MishwarCubit>().startLocationPicker();
                      }
                    },
                    icon: const Icon(Icons.add, size: 18),
                    label: const Text(
                      'أضف مكاناً',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
          floatingActionButtonLocation: FloatingActionButtonLocation.startFloat,
          body: SafeArea(
            child: LayoutBuilder(
              builder: (context, constraints) {
                final availableHeight = constraints.maxHeight;
                final sheetHeight = availableHeight * _sheetFraction;

                return Stack(
                  children: [
                    // MAP (Always in background, preserved across mode switches)
                    Positioned.fill(
                      child: IgnorePointer(
                        ignoring: _isGalleryMode,
                        child: MishwarMapPane(
                          key: _mapPaneKey,
                          features: mapFeatures,
                          highlightedId: state.highlightedPlaceId ?? state.highlightedHotelId,
                          highlightedType: state.highlightedPlaceId != null
                              ? 'place'
                              : (state.highlightedHotelId != null ? 'hotel' : null),
                          bottomOffsetRatio: MishwarSheetConstants.collapsedFraction,
                          onClusterTapped: () {
                            if (_sheetFraction > MishwarSheetConstants.collapsedFraction) {
                              _animateSheetTo(MishwarSheetConstants.collapsedFraction);
                            }
                          },
                          onMapTapped: () {
                            if (_sheetFraction > MishwarSheetConstants.collapsedFraction) {
                              _animateSheetTo(MishwarSheetConstants.collapsedFraction);
                            }
                          },
                          onPlaceSelected: (id) {
                            final feature = state.mapPlaces.cast<PlaceMapFeature?>().firstWhere(
                              (f) => f?.properties.id == id,
                              orElse: () => null,
                            );
                            final lat = feature?.geometry.latitude ?? MapConstants.defaultLat;
                            final lng = feature?.geometry.longitude ?? MapConstants.defaultLon;
                            _openPlaceDetail(
                              placeId: id,
                              lat: lat,
                              lng: lng,
                              name: feature?.properties.displayName,
                              category: feature?.properties.category,
                            );
                          },
                          onHotelSelected: (id) {
                            final feature = state.mapHotels.cast<HotelMapFeature?>().firstWhere(
                              (f) => f?.properties.id == id,
                              orElse: () => null,
                            );
                            final lat = feature?.geometry.latitude;
                            final lng = feature?.geometry.longitude;
                            _openHotelDetail(
                              hotelId: id,
                              lat: lat,
                              lng: lng,
                              name: feature?.properties.displayName,
                            );
                          },
                          isHotelMap: _typeFilter == 'hotels',
                          isPickingLocation: state.isPickingLocation,
                          onLocationPicked: (point) {
                            if (!mounted) return;
                            context.read<MishwarCubit>().onLocationPicked(point.latitude, point.longitude);
                            AddPlaceBottomSheet.show(
                              context,
                              lat: point.latitude,
                              lng: point.longitude,
                            );
                          },
                          onCancelLocationPicker: () => context.read<MishwarCubit>().cancelLocationPicker(),
                        ),
                      ),
                    ),

                    if (!_isGalleryMode) ...[
                      // Expandable Bottom Sheet
                      Positioned(
                        left: 0,
                        right: 0,
                        bottom: 0,
                        height: sheetHeight,
                      child: Container(
                        decoration: const BoxDecoration(
                          color: Color(0xFFFCFBF7),
                          borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
                          boxShadow: [
                            BoxShadow(
                              color: Color(0x28000000),
                              blurRadius: 12,
                              offset: Offset(0, -3),
                            ),
                          ],
                        ),
                        child: Directionality(
                          textDirection: TextDirection.rtl,
                          child: Column(
                            children: [
                              // Drag handle and TabBar area with drag gestures
                              GestureDetector(
                                behavior: HitTestBehavior.translucent,
                                onVerticalDragUpdate: (details) {
                                  if (_sheetAnimController.isAnimating) {
                                    _sheetAnimController.stop();
                                  }
                                  setState(() {
                                    _sheetFraction = (_sheetFraction - details.primaryDelta! / availableHeight)
                                        .clamp(MishwarSheetConstants.minFraction, MishwarSheetConstants.maxFraction);
                                  });
                                },
                                onVerticalDragEnd: (details) {
                                  _snapToClosestFraction(details.primaryVelocity);
                                },
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    // Drag Handle
                                    Center(
                                      child: InkWell(
                                        onTap: () {
                                          if (_sheetFraction < MishwarSheetConstants.swipeUpThreshold) {
                                            _animateSheetTo(MishwarSheetConstants.midFraction);
                                          } else if (_sheetFraction < MishwarSheetConstants.tapExpandThreshold) {
                                            _animateSheetTo(MishwarSheetConstants.maxFraction);
                                          } else {
                                            _animateSheetTo(MishwarSheetConstants.midFraction);
                                          }
                                        },
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 24),
                                          child: Container(
                                            width: 38,
                                            height: 4.5,
                                            decoration: BoxDecoration(
                                              color: const Color(0xFFD4C8B8),
                                              borderRadius: BorderRadius.circular(3),
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),

                                    // Tabs Bar
                                    Container(
                                      margin: const EdgeInsets.symmetric(horizontal: 16),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFF3ECE3),
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                      child: TabBar(
                                        controller: _tabController,
                                        isScrollable: state.isLoggedIn,
                                        tabAlignment: state.isLoggedIn ? TabAlignment.start : TabAlignment.fill,
                                        indicatorSize: TabBarIndicatorSize.tab,
                                        indicator: BoxDecoration(
                                          color: Colors.white,
                                          borderRadius: BorderRadius.circular(8),
                                          boxShadow: const [
                                            BoxShadow(
                                              color: Color(0x15000000),
                                              blurRadius: 4,
                                              offset: Offset(0, 1),
                                            ),
                                          ],
                                        ),
                                        labelColor: const Color(0xFF2F2722),
                                        unselectedLabelColor: const Color(0xFF8D7E6E),
                                        labelStyle: const TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w700,
                                        ),
                                        unselectedLabelStyle: const TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w500,
                                        ),
                                        dividerColor: Colors.transparent,
                                        padding: const EdgeInsets.all(3),
                                        tabs: tabs,
                                      ),
                                    ),
                                    const SizedBox(height: 6),
                                  ],
                                ),
                              ),

                              // Tab View Contents with Scroll Listener
                              Expanded(
                                child: NotificationListener<ScrollNotification>(
                                  onNotification: (notification) {
                                    if (notification.metrics.axis != Axis.vertical) {
                                      return false;
                                    }

                                    if (notification is ScrollUpdateNotification) {
                                      final delta = notification.scrollDelta ?? 0;
                                      if (delta > 0 && _sheetFraction < MishwarSheetConstants.scrollExpandThreshold) {
                                        setState(() {
                                          _sheetFraction = (_sheetFraction + delta / availableHeight)
                                              .clamp(MishwarSheetConstants.minFraction, MishwarSheetConstants.maxFraction);
                                        });
                                        return true;
                                      }
                                      if (delta < 0 && notification.metrics.pixels <= 0 && _sheetFraction > MishwarSheetConstants.collapsedFraction) {
                                        setState(() {
                                          _sheetFraction = (_sheetFraction + delta / availableHeight)
                                              .clamp(MishwarSheetConstants.minFraction, MishwarSheetConstants.maxFraction);
                                        });
                                        return true;
                                      }
                                    } else if (notification is OverscrollNotification) {
                                      if (notification.overscroll < 0 && _sheetFraction > MishwarSheetConstants.collapsedFraction) {
                                        setState(() {
                                          _sheetFraction = (_sheetFraction - notification.overscroll / availableHeight)
                                              .clamp(MishwarSheetConstants.minFraction, MishwarSheetConstants.maxFraction);
                                        });
                                        return true;
                                      }
                                    } else if (notification is ScrollEndNotification) {
                                      _snapToClosestFraction(0);
                                    }
                                    return false;
                                  },
                                  child: TabBarView(
                                    controller: _tabController,
                                    children: tabViews,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],

                  // Gallery Mode Grid (lazily mounted on first open, then kept alive via Offstage)
                  if (_hasEverOpenedGallery)
                    Positioned.fill(
                      child: Offstage(
                        offstage: !_isGalleryMode,
                        child: Container(
                          color: const Color(0xFFFAF6F0),
                          child: MishwarGalleryView(
                            onPlaceTap: (place) {
                              setState(() {
                                _isGalleryMode = false;
                              });
                              _openPlaceDetail(
                                placeId: place.id,
                                lat: place.lat,
                                lng: place.lng,
                                name: place.name,
                                category: place.category,
                              );
                            },
                          ),
                        ),
                      ),
                    ),

                  // Floating Search Bar & Controls on Map / Gallery
                  if (!state.isPickingLocation)
                    Positioned(
                      top: 12,
                      left: 16,
                      right: 16,
                      child: MishwarSearchBar(
                        isGalleryMode: _isGalleryMode,
                        onViewModeChanged: (isGallery) {
                          setState(() {
                            _isGalleryMode = isGallery;
                            if (isGallery) {
                              _hasEverOpenedGallery = true;
                            }
                          });
                        },
                        onOpenFilter: () => _openFilterBottomSheet(context, state),
                        activeFilterLabel: activeFilterLabel,
                        hasActiveFilter: hasActiveFilter,
                        onPlaceSelected: (place) {
                          if (_isGalleryMode) {
                            setState(() {
                              _isGalleryMode = false;
                            });
                          }
                          _openPlaceDetail(
                            placeId: place.id,
                            lat: place.lat,
                            lng: place.lng,
                            name: place.name,
                            category: place.category,
                          );
                        },
                      ),
                    ),
                ],
              );
              },
            ),
          ),
        ),
      );
    },
  );
}
}
