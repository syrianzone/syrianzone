import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:syrianzone/core/network/response/guides_response.dart';
import 'package:syrianzone/core/network/response/hotel_response.dart';
import 'package:syrianzone/core/network/response/places_map_response.dart';
import 'package:syrianzone/core/network/response/places_response.dart';

part 'mishwar_state.freezed.dart';

@freezed
sealed class MishwarState with _$MishwarState {
  factory MishwarState({
    @Default(0) int selectedTabIndex,
    @Default(false) bool isLoggedIn,

    // Places tab
    @Default([]) List<PlaceResponse> places,
    @Default(false) bool isLoadingPlaces,
    String? placesError,
    @Default(1) int placesPage,
    @Default(true) bool hasMorePlaces,
    String? selectedCategory,
    int? filterUserId,
    String? filterUserName,

    // Places Search (isolated to search bar)
    @Default([]) List<PlaceResponse> searchResults,
    @Default(false) bool isSearching,
    String? searchError,
    String? placesSearchQuery,

    // Places Map
    @Default([]) List<PlaceMapFeature> mapPlaces,
    @Default(false) bool isLoadingMapPlaces,

    // Hotels tab
    @Default([]) List<HotelResponse> hotels,
    @Default(false) bool isLoadingHotels,
    String? hotelsError,
    @Default(1) int hotelsPage,
    @Default(true) bool hasMoreHotels,

    // Hotels Map
    @Default([]) List<PlaceMapFeature> mapHotels,
    @Default(false) bool isLoadingMapHotels,

    // Guides tab
    @Default([]) List<GuideItemResponse> guides,
    @Default(false) bool isLoadingGuides,
    String? guidesError,
    @Default('points') String guidesSort,

    // Map highlights
    int? highlightedPlaceId,
    int? highlightedHotelId,

    // Add place flow
    @Default(false) bool isPickingLocation,
    double? pickedLat,
    double? pickedLng,
    @Default(false) bool isSubmittingPlace,
    String? submitPlaceError,
    @Default(false) bool submitPlaceSuccess,
  }) = _MishwarState;
}
