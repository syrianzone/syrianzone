import 'dart:async';
import 'package:bloc/bloc.dart';
import 'package:dio/dio.dart';
import 'package:syrianzone/core/bloc/safe_emit_mixin.dart';
import 'package:syrianzone/core/network/api_result.dart';
import 'package:syrianzone/feature/auth/logic/auth_cubit.dart';
import 'package:syrianzone/feature/auth/logic/auth_state.dart';
import 'package:syrianzone/feature/mishwar/logic/mishwar_state.dart';
import 'package:syrianzone/feature/mishwar/repo/mishwar_repo.dart';

class MishwarCubit extends Cubit<MishwarState> with SafeEmit<MishwarState> {
  final MishwarRepo _repo;
  final AuthCubit? _authCubit;
  StreamSubscription<AuthState>? _authSub;

  MishwarCubit(this._repo, [this._authCubit])
      : super(MishwarState(isLoggedIn: _authCubit?.isAuthenticated ?? false)) {
    _authSub = _authCubit?.stream.listen((authState) {
      final loggedIn = authState.maybeWhen(
        authenticated: (_) => true,
        orElse: () => false,
      );
      if (state.isLoggedIn != loggedIn) {
        setLoggedIn(loggedIn);
      }
    });
  }

  Timer? _searchDebounce;
  CancelToken? _placesCancelToken;
  CancelToken? _searchCancelToken;
  CancelToken? _guidesCancelToken;
  CancelToken? _galleryCancelToken;


  void setTab(int index) {
    safeEmit(state.copyWith(selectedTabIndex: index));
    // When not logged in, index 2 is Guides. When logged in, index 4 is Guides.
    final isGuidesTab = state.isLoggedIn ? (index == 4) : (index == 2);
    if (index == 0 && state.places.isEmpty) {
      fetchPlaces();
    } else if (index == 1 && state.hotels.isEmpty) {
      fetchHotels();
    } else if (state.isLoggedIn && index == 2 && state.savedPlaces.isEmpty) {
      fetchSavedPlaces();
    } else if (state.isLoggedIn && index == 3 && state.myContributions.isEmpty) {
      fetchMyContributions();
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

    _placesCancelToken?.cancel();
    final cancelToken = _placesCancelToken = CancelToken();

    final result = await _repo.getPlaces(
      category: state.selectedCategory,
      query: null,
      page: page,
      userId: state.filterUserId,
      cancelToken: cancelToken,
    );

    if (cancelToken.isCancelled) return;

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

      _searchCancelToken?.cancel();
      final cancelToken = _searchCancelToken = CancelToken();

      final result = await _repo.getPlaces(
        query: trimmed,
        page: 1,
        cancelToken: cancelToken,
      );

      if (cancelToken.isCancelled) return;

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
    _searchCancelToken?.cancel();
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
    _authSub?.cancel();
    _searchDebounce?.cancel();
    _placesCancelToken?.cancel();
    _searchCancelToken?.cancel();
    _guidesCancelToken?.cancel();
    _galleryCancelToken?.cancel();
    return super.close();
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

  void highlightPlace(int? id) {
    safeEmit(state.copyWith(
      highlightedPlaceId: id,
      highlightedHotelId: null,
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

  void highlightHotel(int? id) {
    safeEmit(state.copyWith(
      highlightedHotelId: id,
      highlightedPlaceId: null,
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

    _guidesCancelToken?.cancel();
    final cancelToken = _guidesCancelToken = CancelToken();

    final result = await _repo.getGuides(sort: sortKey, cancelToken: cancelToken);
    if (cancelToken.isCancelled) return;

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
    safeEmit(state.copyWith(
      isLoggedIn: loggedIn,
      savedPlaces: loggedIn ? state.savedPlaces : [],
      myContributions: loggedIn ? state.myContributions : [],
    ));
    if (loggedIn) {
      if (state.selectedTabIndex == 2) fetchSavedPlaces(refresh: true);
      if (state.selectedTabIndex == 3) fetchMyContributions(refresh: true);
    }
  }

  // --- Saved Places (محفوظاتي) ---
  Future<void> fetchSavedPlaces({bool refresh = false}) async {
    if (!refresh && state.isLoadingSavedPlaces) return;

    final page = refresh ? 1 : state.savedPlacesPage;
    safeEmit(state.copyWith(
      isLoadingSavedPlaces: true,
      savedPlacesError: null,
      savedPlacesPage: page,
      savedPlaces: refresh ? [] : state.savedPlaces,
    ));

    final result = await _repo.getMySavedPlaces(page: page);
    result.when(
      success: (response) {
        final newPlaces = refresh ? response.data : [...state.savedPlaces, ...response.data];
        final hasMore = response.currentPage < response.lastPage;
        safeEmit(state.copyWith(
          savedPlaces: newPlaces,
          isLoadingSavedPlaces: false,
          savedPlacesError: null,
          savedPlacesPage: page + 1,
          hasMoreSavedPlaces: hasMore,
        ));
      },
      error: (error) {
        safeEmit(state.copyWith(
          isLoadingSavedPlaces: false,
          savedPlacesError: error,
        ));
      },
    );
  }

  // --- My Contributions (مساهماتي) ---
  Future<void> fetchMyContributions({bool refresh = false}) async {
    if (!refresh && state.isLoadingMyContributions) return;

    final page = refresh ? 1 : state.myContributionsPage;
    safeEmit(state.copyWith(
      isLoadingMyContributions: true,
      myContributionsError: null,
      myContributionsPage: page,
      myContributions: refresh ? [] : state.myContributions,
    ));

    final result = await _repo.getMyPlaces(page: page);
    result.when(
      success: (response) {
        final newPlaces = refresh ? response.data : [...state.myContributions, ...response.data];
        final hasMore = response.currentPage < response.lastPage;
        safeEmit(state.copyWith(
          myContributions: newPlaces,
          isLoadingMyContributions: false,
          myContributionsError: null,
          myContributionsPage: page + 1,
          hasMoreMyContributions: hasMore,
        ));
      },
      error: (error) {
        safeEmit(state.copyWith(
          isLoadingMyContributions: false,
          myContributionsError: error,
        ));
      },
    );
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

  // --- Gallery Photos (/api/v1/places/photos) ---
  Future<void> fetchGalleryPhotos({bool refresh = false}) async {
    if (!refresh && (state.isLoadingGallery || !state.hasMoreGalleryPhotos)) return;

    final page = refresh ? 1 : state.galleryPage;
    safeEmit(state.copyWith(
      isLoadingGallery: true,
      galleryError: null,
      galleryPage: page,
      galleryPhotos: refresh ? [] : state.galleryPhotos,
    ));

    _galleryCancelToken?.cancel();
    final cancelToken = _galleryCancelToken = CancelToken();

    final result = await _repo.getPlacePhotos(
      page: page,
      cancelToken: cancelToken,
    );

    if (cancelToken.isCancelled) return;

    result.when(
      success: (response) {
        final newPhotos = refresh
            ? response.data
            : [...state.galleryPhotos, ...response.data];
        final hasMore = response.currentPage < response.lastPage;
        safeEmit(state.copyWith(
          galleryPhotos: newPhotos,
          isLoadingGallery: false,
          galleryError: null,
          hasMoreGalleryPhotos: hasMore,
          galleryPage: page + 1,
        ));
      },
      error: (error) {
        safeEmit(state.copyWith(
          isLoadingGallery: false,
          galleryError: error,
        ));
      },
    );
  }
}
