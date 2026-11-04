import 'dart:async';
import 'package:bloc/bloc.dart';
import 'package:syrianzone/core/bloc/safe_emit_mixin.dart';
import 'package:syrianzone/core/network/api_result.dart';
import 'package:syrianzone/core/network/response/guides_response.dart';
import 'package:syrianzone/feature/mishwar/logic/mishwar_state.dart';
import 'package:syrianzone/feature/mishwar/repo/mishwar_repo.dart';

class MishwarCubit extends Cubit<MishwarState> with SafeEmit<MishwarState> {
  final MishwarRepo _repo;

  MishwarCubit(this._repo) : super(MishwarState());

  Timer? _searchDebounce;


  void setTab(int index) {
    safeEmit(state.copyWith(selectedTabIndex: index));
    // When not logged in, index 2 is Guides. When logged in, index 4 is Guides.
    final isGuidesTab = state.isLoggedIn ? (index == 4) : (index == 2);
    if (index == 0 && state.places.isEmpty) {
      fetchPlaces();
    } else if (index == 1 && state.hotels.isEmpty) {
      fetchHotels();
    } else if (isGuidesTab && state.guides.isEmpty) {
      fetchGuides();
    }
  }

  Future<void> loadInitialData() async {
    await Future.wait([
      fetchPlaces(refresh: true),
      fetchPlacesMap(),
      fetchHotelsMap(),
    ]);
  }

  // --- Places ---
  Future<void> fetchPlaces({bool refresh = false}) async {
    if (!refresh && state.isLoadingPlaces) return;

    final page = refresh ? 1 : state.placesPage;
    safeEmit(state.copyWith(
      isLoadingPlaces: true,
      placesError: null,
      placesPage: page,
      places: refresh ? [] : state.places,
    ));

    final result = await _repo.getPlaces(
      category: state.selectedCategory,
      query: null,
      page: page,
      userId: state.filterUserId,
    );

    result.when(
      success: (response) {
        final newPlaces = refresh
            ? response.data
            : [...state.places, ...response.data];
        final hasMore = response.currentPage < response.lastPage;
        safeEmit(state.copyWith(
          places: newPlaces,
          isLoadingPlaces: false,
          placesError: null,
          hasMorePlaces: hasMore,
          placesPage: page + 1,
        ));
      },
      error: (error) {
        safeEmit(state.copyWith(
          isLoadingPlaces: false,
          placesError: error,
        ));
      },
    );
  }

  void filterCategory(String? category) {
    if (state.selectedCategory == category) return;
    safeEmit(state.copyWith(
      selectedCategory: category,
      places: [],
      placesPage: 1,
    ));
    fetchPlaces(refresh: true);
  }

  void filterByUser(int userId, String name) {
    safeEmit(state.copyWith(
      filterUserId: userId,
      filterUserName: name,
      selectedTabIndex: 0,
      places: [],
      placesPage: 1,
    ));
    fetchPlaces(refresh: true);
  }

  void clearUserFilter() {
    if (state.filterUserId == null) return;
    safeEmit(state.copyWith(
      filterUserId: null,
      filterUserName: null,
      places: [],
      placesPage: 1,
    ));
    fetchPlaces(refresh: true);
  }


  void searchPlaces(String query) {
    _searchDebounce?.cancel();
    final trimmed = query.trim();
    if (trimmed.isEmpty) {
      clearPlacesSearch();
      return;
    }

    _searchDebounce = Timer(const Duration(milliseconds: 300), () async {
      safeEmit(state.copyWith(
        placesSearchQuery: trimmed,
        isSearching: true,
        searchError: null,
      ));

      final result = await _repo.getPlaces(
        query: trimmed,
        page: 1,
      );

      result.when(
        success: (response) {
          safeEmit(state.copyWith(
            searchResults: response.data,
            isSearching: false,
            searchError: null,
          ));
        },
        error: (error) {
          safeEmit(state.copyWith(
            searchResults: [],
            isSearching: false,
            searchError: error,
          ));
        },
      );
    });
  }

  void clearPlacesSearch() {
    _searchDebounce?.cancel();
    if (state.placesSearchQuery == null && state.searchResults.isEmpty) return;
    safeEmit(state.copyWith(
      placesSearchQuery: null,
      searchResults: [],
      isSearching: false,
      searchError: null,
    ));
  }

  @override
  Future<void> close() {
    _searchDebounce?.cancel();
    return super.close();
  }

  void selectGuide(GuideItemResponse guide) {
    safeEmit(state.copyWith(selectedGuide: guide));
  }

  void clearSelectedGuide() {
    safeEmit(state.copyWith(selectedGuide: null));
  }

  Future<void> fetchPlacesMap() async {
    safeEmit(state.copyWith(isLoadingMapPlaces: true));
    final result = await _repo.getPlacesMap();
    result.when(
      success: (response) {
        safeEmit(state.copyWith(
          mapPlaces: response.features,
          isLoadingMapPlaces: false,
        ));
      },
      error: (_) {
        safeEmit(state.copyWith(isLoadingMapPlaces: false));
      },
    );
  }

  Future<void> selectPlace(int id) async {
    safeEmit(state.copyWith(
      highlightedPlaceId: id,
      selectedPlace: null,
      isLoadingPlaceDetail: true,
    ));

    final result = await _repo.getPlaceDetail(id);
    result.when(
      success: (place) {
        safeEmit(state.copyWith(
          selectedPlace: place,
          isLoadingPlaceDetail: false,
        ));
      },
      error: (error) {
        safeEmit(state.copyWith(
          isLoadingPlaceDetail: false,
        ));
      },
    );
  }

  void highlightPlace(int? id) {
    safeEmit(state.copyWith(highlightedPlaceId: id));
  }

  void clearSelectedPlace() {
    safeEmit(state.copyWith(
      selectedPlace: null,
      highlightedPlaceId: null,
    ));
  }

  // --- Hotels ---
  Future<void> fetchHotels({bool refresh = false}) async {
    if (!refresh && state.isLoadingHotels) return;

    final page = refresh ? 1 : state.hotelsPage;
    safeEmit(state.copyWith(
      isLoadingHotels: true,
      hotelsError: null,
      hotelsPage: page,
      hotels: refresh ? [] : state.hotels,
    ));

    final result = await _repo.getHotels(page: page);
    result.when(
      success: (response) {
        final newHotels = refresh
            ? response.data
            : [...state.hotels, ...response.data];
        final hasMore = response.currentPage < response.lastPage;
        safeEmit(state.copyWith(
          hotels: newHotels,
          isLoadingHotels: false,
          hotelsError: null,
          hasMoreHotels: hasMore,
          hotelsPage: page + 1,
        ));
      },
      error: (error) {
        safeEmit(state.copyWith(
          isLoadingHotels: false,
          hotelsError: error,
        ));
      },
    );
  }

  Future<void> fetchHotelsMap() async {
    safeEmit(state.copyWith(isLoadingMapHotels: true));
    final result = await _repo.getHotelsMap();
    result.when(
      success: (response) {
        safeEmit(state.copyWith(
          mapHotels: response.features,
          isLoadingMapHotels: false,
        ));
      },
      error: (_) {
        safeEmit(state.copyWith(isLoadingMapHotels: false));
      },
    );
  }

  Future<void> selectHotel(int id) async {
    safeEmit(state.copyWith(
      highlightedHotelId: id,
      selectedHotel: null,
      isLoadingHotelDetail: true,
    ));

    final result = await _repo.getHotelDetail(id);
    result.when(
      success: (hotel) {
        safeEmit(state.copyWith(
          selectedHotel: hotel,
          isLoadingHotelDetail: false,
        ));
      },
      error: (error) {
        safeEmit(state.copyWith(
          isLoadingHotelDetail: false,
        ));
      },
    );
  }

  void highlightHotel(int? id) {
    safeEmit(state.copyWith(highlightedHotelId: id));
  }

  void clearSelectedHotel() {
    safeEmit(state.copyWith(
      selectedHotel: null,
      highlightedHotelId: null,
    ));
  }

  // --- Guides ---
  Future<void> fetchGuides({String? sort}) async {
    final sortKey = sort ?? state.guidesSort;
    final isDifferentSort = sort != null && sort != state.guidesSort;
    safeEmit(state.copyWith(
      isLoadingGuides: true,
      guides: isDifferentSort ? [] : state.guides,
      guidesError: null,
      guidesSort: sortKey,
    ));

    final result = await _repo.getGuides(sort: sortKey);
    result.when(
      success: (response) {
        safeEmit(state.copyWith(
          guides: response.guides,
          isLoadingGuides: false,
          guidesError: null,
        ));
      },
      error: (error) {
        safeEmit(state.copyWith(
          isLoadingGuides: false,
          guidesError: error,
        ));
      },
    );
  }

  void setLoggedIn(bool loggedIn) {
    safeEmit(state.copyWith(isLoggedIn: loggedIn));
  }

  // --- Add Place Flow ---
  void startLocationPicker() {
    safeEmit(state.copyWith(
      isPickingLocation: true,
      pickedLat: null,
      pickedLng: null,
      submitPlaceError: null,
      submitPlaceSuccess: false,
    ));
  }

  void cancelLocationPicker() {
    safeEmit(state.copyWith(
      isPickingLocation: false,
      pickedLat: null,
      pickedLng: null,
    ));
  }

  void onLocationPicked(double lat, double lng) {
    safeEmit(state.copyWith(
      isPickingLocation: false,
      pickedLat: lat,
      pickedLng: lng,
    ));
  }

  void clearPickedLocation() {
    safeEmit(state.copyWith(
      pickedLat: null,
      pickedLng: null,
    ));
  }

  Future<bool> submitPlace({
    required String name,
    required String category,
    required String description,
    required double lat,
    required double lng,
    required List<String> photoPaths,
  }) async {
    safeEmit(state.copyWith(
      isSubmittingPlace: true,
      submitPlaceError: null,
      submitPlaceSuccess: false,
    ));

    final result = await _repo.submitPlace(
      name: name,
      category: category,
      description: description,
      lat: lat,
      lng: lng,
      photoPaths: photoPaths,
    );

    return result.when(
      success: (data) {
        safeEmit(state.copyWith(
          isSubmittingPlace: false,
          submitPlaceSuccess: true,
          submitPlaceError: null,
          pickedLat: null,
          pickedLng: null,
        ));
        // Refresh places list & map data
        fetchPlaces(refresh: true);
        fetchPlacesMap();
        return true;
      },
      error: (error) {
        safeEmit(state.copyWith(
          isSubmittingPlace: false,
          submitPlaceSuccess: false,
          submitPlaceError: error,
        ));
        return false;
      },
    );
  }
}
