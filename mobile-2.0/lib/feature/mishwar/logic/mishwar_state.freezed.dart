// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'mishwar_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$MishwarState {

 int get selectedTabIndex; bool get isLoggedIn;// Places tab
 List<PlaceResponse> get places; bool get isLoadingPlaces; String? get placesError; int get placesPage; bool get hasMorePlaces; String? get selectedCategory; int? get filterUserId; String? get filterUserName;// Places Search (isolated to search bar)
 List<PlaceResponse> get searchResults; bool get isSearching; String? get searchError; String? get placesSearchQuery;// Places Map
 List<PlaceMapFeature> get mapPlaces; bool get isLoadingMapPlaces;// Hotels tab
 List<HotelResponse> get hotels; bool get isLoadingHotels; String? get hotelsError; int get hotelsPage; bool get hasMoreHotels;// Hotels Map
 List<PlaceMapFeature> get mapHotels; bool get isLoadingMapHotels;// Guides tab
 List<GuideItemResponse> get guides; bool get isLoadingGuides; String? get guidesError; String get guidesSort;// Gallery tab 
 List<PlacePhotoFeedItem> get galleryPhotos; bool get isLoadingGallery; String? get galleryError; int get galleryPage; bool get hasMoreGalleryPhotos;// Saved places tab (محفوظاتي)
 List<PlaceResponse> get savedPlaces; bool get isLoadingSavedPlaces; String? get savedPlacesError; int get savedPlacesPage; bool get hasMoreSavedPlaces;// My contributions tab (مساهماتي)
 List<PlaceResponse> get myContributions; bool get isLoadingMyContributions; String? get myContributionsError; int get myContributionsPage; bool get hasMoreMyContributions;// Map highlights
 int? get highlightedPlaceId; int? get highlightedHotelId;// Add place flow
 bool get isPickingLocation; double? get pickedLat; double? get pickedLng; bool get isSubmittingPlace; String? get submitPlaceError; bool get submitPlaceSuccess;
/// Create a copy of MishwarState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$MishwarStateCopyWith<MishwarState> get copyWith => _$MishwarStateCopyWithImpl<MishwarState>(this as MishwarState, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is MishwarState&&(identical(other.selectedTabIndex, selectedTabIndex) || other.selectedTabIndex == selectedTabIndex)&&(identical(other.isLoggedIn, isLoggedIn) || other.isLoggedIn == isLoggedIn)&&const DeepCollectionEquality().equals(other.places, places)&&(identical(other.isLoadingPlaces, isLoadingPlaces) || other.isLoadingPlaces == isLoadingPlaces)&&(identical(other.placesError, placesError) || other.placesError == placesError)&&(identical(other.placesPage, placesPage) || other.placesPage == placesPage)&&(identical(other.hasMorePlaces, hasMorePlaces) || other.hasMorePlaces == hasMorePlaces)&&(identical(other.selectedCategory, selectedCategory) || other.selectedCategory == selectedCategory)&&(identical(other.filterUserId, filterUserId) || other.filterUserId == filterUserId)&&(identical(other.filterUserName, filterUserName) || other.filterUserName == filterUserName)&&const DeepCollectionEquality().equals(other.searchResults, searchResults)&&(identical(other.isSearching, isSearching) || other.isSearching == isSearching)&&(identical(other.searchError, searchError) || other.searchError == searchError)&&(identical(other.placesSearchQuery, placesSearchQuery) || other.placesSearchQuery == placesSearchQuery)&&const DeepCollectionEquality().equals(other.mapPlaces, mapPlaces)&&(identical(other.isLoadingMapPlaces, isLoadingMapPlaces) || other.isLoadingMapPlaces == isLoadingMapPlaces)&&const DeepCollectionEquality().equals(other.hotels, hotels)&&(identical(other.isLoadingHotels, isLoadingHotels) || other.isLoadingHotels == isLoadingHotels)&&(identical(other.hotelsError, hotelsError) || other.hotelsError == hotelsError)&&(identical(other.hotelsPage, hotelsPage) || other.hotelsPage == hotelsPage)&&(identical(other.hasMoreHotels, hasMoreHotels) || other.hasMoreHotels == hasMoreHotels)&&const DeepCollectionEquality().equals(other.mapHotels, mapHotels)&&(identical(other.isLoadingMapHotels, isLoadingMapHotels) || other.isLoadingMapHotels == isLoadingMapHotels)&&const DeepCollectionEquality().equals(other.guides, guides)&&(identical(other.isLoadingGuides, isLoadingGuides) || other.isLoadingGuides == isLoadingGuides)&&(identical(other.guidesError, guidesError) || other.guidesError == guidesError)&&(identical(other.guidesSort, guidesSort) || other.guidesSort == guidesSort)&&const DeepCollectionEquality().equals(other.galleryPhotos, galleryPhotos)&&(identical(other.isLoadingGallery, isLoadingGallery) || other.isLoadingGallery == isLoadingGallery)&&(identical(other.galleryError, galleryError) || other.galleryError == galleryError)&&(identical(other.galleryPage, galleryPage) || other.galleryPage == galleryPage)&&(identical(other.hasMoreGalleryPhotos, hasMoreGalleryPhotos) || other.hasMoreGalleryPhotos == hasMoreGalleryPhotos)&&const DeepCollectionEquality().equals(other.savedPlaces, savedPlaces)&&(identical(other.isLoadingSavedPlaces, isLoadingSavedPlaces) || other.isLoadingSavedPlaces == isLoadingSavedPlaces)&&(identical(other.savedPlacesError, savedPlacesError) || other.savedPlacesError == savedPlacesError)&&(identical(other.savedPlacesPage, savedPlacesPage) || other.savedPlacesPage == savedPlacesPage)&&(identical(other.hasMoreSavedPlaces, hasMoreSavedPlaces) || other.hasMoreSavedPlaces == hasMoreSavedPlaces)&&const DeepCollectionEquality().equals(other.myContributions, myContributions)&&(identical(other.isLoadingMyContributions, isLoadingMyContributions) || other.isLoadingMyContributions == isLoadingMyContributions)&&(identical(other.myContributionsError, myContributionsError) || other.myContributionsError == myContributionsError)&&(identical(other.myContributionsPage, myContributionsPage) || other.myContributionsPage == myContributionsPage)&&(identical(other.hasMoreMyContributions, hasMoreMyContributions) || other.hasMoreMyContributions == hasMoreMyContributions)&&(identical(other.highlightedPlaceId, highlightedPlaceId) || other.highlightedPlaceId == highlightedPlaceId)&&(identical(other.highlightedHotelId, highlightedHotelId) || other.highlightedHotelId == highlightedHotelId)&&(identical(other.isPickingLocation, isPickingLocation) || other.isPickingLocation == isPickingLocation)&&(identical(other.pickedLat, pickedLat) || other.pickedLat == pickedLat)&&(identical(other.pickedLng, pickedLng) || other.pickedLng == pickedLng)&&(identical(other.isSubmittingPlace, isSubmittingPlace) || other.isSubmittingPlace == isSubmittingPlace)&&(identical(other.submitPlaceError, submitPlaceError) || other.submitPlaceError == submitPlaceError)&&(identical(other.submitPlaceSuccess, submitPlaceSuccess) || other.submitPlaceSuccess == submitPlaceSuccess));
}


@override
int get hashCode => Object.hashAll([runtimeType,selectedTabIndex,isLoggedIn,const DeepCollectionEquality().hash(places),isLoadingPlaces,placesError,placesPage,hasMorePlaces,selectedCategory,filterUserId,filterUserName,const DeepCollectionEquality().hash(searchResults),isSearching,searchError,placesSearchQuery,const DeepCollectionEquality().hash(mapPlaces),isLoadingMapPlaces,const DeepCollectionEquality().hash(hotels),isLoadingHotels,hotelsError,hotelsPage,hasMoreHotels,const DeepCollectionEquality().hash(mapHotels),isLoadingMapHotels,const DeepCollectionEquality().hash(guides),isLoadingGuides,guidesError,guidesSort,const DeepCollectionEquality().hash(galleryPhotos),isLoadingGallery,galleryError,galleryPage,hasMoreGalleryPhotos,const DeepCollectionEquality().hash(savedPlaces),isLoadingSavedPlaces,savedPlacesError,savedPlacesPage,hasMoreSavedPlaces,const DeepCollectionEquality().hash(myContributions),isLoadingMyContributions,myContributionsError,myContributionsPage,hasMoreMyContributions,highlightedPlaceId,highlightedHotelId,isPickingLocation,pickedLat,pickedLng,isSubmittingPlace,submitPlaceError,submitPlaceSuccess]);

@override
String toString() {
  return 'MishwarState(selectedTabIndex: $selectedTabIndex, isLoggedIn: $isLoggedIn, places: $places, isLoadingPlaces: $isLoadingPlaces, placesError: $placesError, placesPage: $placesPage, hasMorePlaces: $hasMorePlaces, selectedCategory: $selectedCategory, filterUserId: $filterUserId, filterUserName: $filterUserName, searchResults: $searchResults, isSearching: $isSearching, searchError: $searchError, placesSearchQuery: $placesSearchQuery, mapPlaces: $mapPlaces, isLoadingMapPlaces: $isLoadingMapPlaces, hotels: $hotels, isLoadingHotels: $isLoadingHotels, hotelsError: $hotelsError, hotelsPage: $hotelsPage, hasMoreHotels: $hasMoreHotels, mapHotels: $mapHotels, isLoadingMapHotels: $isLoadingMapHotels, guides: $guides, isLoadingGuides: $isLoadingGuides, guidesError: $guidesError, guidesSort: $guidesSort, galleryPhotos: $galleryPhotos, isLoadingGallery: $isLoadingGallery, galleryError: $galleryError, galleryPage: $galleryPage, hasMoreGalleryPhotos: $hasMoreGalleryPhotos, savedPlaces: $savedPlaces, isLoadingSavedPlaces: $isLoadingSavedPlaces, savedPlacesError: $savedPlacesError, savedPlacesPage: $savedPlacesPage, hasMoreSavedPlaces: $hasMoreSavedPlaces, myContributions: $myContributions, isLoadingMyContributions: $isLoadingMyContributions, myContributionsError: $myContributionsError, myContributionsPage: $myContributionsPage, hasMoreMyContributions: $hasMoreMyContributions, highlightedPlaceId: $highlightedPlaceId, highlightedHotelId: $highlightedHotelId, isPickingLocation: $isPickingLocation, pickedLat: $pickedLat, pickedLng: $pickedLng, isSubmittingPlace: $isSubmittingPlace, submitPlaceError: $submitPlaceError, submitPlaceSuccess: $submitPlaceSuccess)';
}


}

/// @nodoc
abstract mixin class $MishwarStateCopyWith<$Res>  {
  factory $MishwarStateCopyWith(MishwarState value, $Res Function(MishwarState) _then) = _$MishwarStateCopyWithImpl;
@useResult
$Res call({
 int selectedTabIndex, bool isLoggedIn, List<PlaceResponse> places, bool isLoadingPlaces, String? placesError, int placesPage, bool hasMorePlaces, String? selectedCategory, int? filterUserId, String? filterUserName, List<PlaceResponse> searchResults, bool isSearching, String? searchError, String? placesSearchQuery, List<PlaceMapFeature> mapPlaces, bool isLoadingMapPlaces, List<HotelResponse> hotels, bool isLoadingHotels, String? hotelsError, int hotelsPage, bool hasMoreHotels, List<PlaceMapFeature> mapHotels, bool isLoadingMapHotels, List<GuideItemResponse> guides, bool isLoadingGuides, String? guidesError, String guidesSort, List<PlacePhotoFeedItem> galleryPhotos, bool isLoadingGallery, String? galleryError, int galleryPage, bool hasMoreGalleryPhotos, List<PlaceResponse> savedPlaces, bool isLoadingSavedPlaces, String? savedPlacesError, int savedPlacesPage, bool hasMoreSavedPlaces, List<PlaceResponse> myContributions, bool isLoadingMyContributions, String? myContributionsError, int myContributionsPage, bool hasMoreMyContributions, int? highlightedPlaceId, int? highlightedHotelId, bool isPickingLocation, double? pickedLat, double? pickedLng, bool isSubmittingPlace, String? submitPlaceError, bool submitPlaceSuccess
});




}
/// @nodoc
class _$MishwarStateCopyWithImpl<$Res>
    implements $MishwarStateCopyWith<$Res> {
  _$MishwarStateCopyWithImpl(this._self, this._then);

  final MishwarState _self;
  final $Res Function(MishwarState) _then;

/// Create a copy of MishwarState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? selectedTabIndex = null,Object? isLoggedIn = null,Object? places = null,Object? isLoadingPlaces = null,Object? placesError = freezed,Object? placesPage = null,Object? hasMorePlaces = null,Object? selectedCategory = freezed,Object? filterUserId = freezed,Object? filterUserName = freezed,Object? searchResults = null,Object? isSearching = null,Object? searchError = freezed,Object? placesSearchQuery = freezed,Object? mapPlaces = null,Object? isLoadingMapPlaces = null,Object? hotels = null,Object? isLoadingHotels = null,Object? hotelsError = freezed,Object? hotelsPage = null,Object? hasMoreHotels = null,Object? mapHotels = null,Object? isLoadingMapHotels = null,Object? guides = null,Object? isLoadingGuides = null,Object? guidesError = freezed,Object? guidesSort = null,Object? galleryPhotos = null,Object? isLoadingGallery = null,Object? galleryError = freezed,Object? galleryPage = null,Object? hasMoreGalleryPhotos = null,Object? savedPlaces = null,Object? isLoadingSavedPlaces = null,Object? savedPlacesError = freezed,Object? savedPlacesPage = null,Object? hasMoreSavedPlaces = null,Object? myContributions = null,Object? isLoadingMyContributions = null,Object? myContributionsError = freezed,Object? myContributionsPage = null,Object? hasMoreMyContributions = null,Object? highlightedPlaceId = freezed,Object? highlightedHotelId = freezed,Object? isPickingLocation = null,Object? pickedLat = freezed,Object? pickedLng = freezed,Object? isSubmittingPlace = null,Object? submitPlaceError = freezed,Object? submitPlaceSuccess = null,}) {
  return _then(_self.copyWith(
selectedTabIndex: null == selectedTabIndex ? _self.selectedTabIndex : selectedTabIndex // ignore: cast_nullable_to_non_nullable
as int,isLoggedIn: null == isLoggedIn ? _self.isLoggedIn : isLoggedIn // ignore: cast_nullable_to_non_nullable
as bool,places: null == places ? _self.places : places // ignore: cast_nullable_to_non_nullable
as List<PlaceResponse>,isLoadingPlaces: null == isLoadingPlaces ? _self.isLoadingPlaces : isLoadingPlaces // ignore: cast_nullable_to_non_nullable
as bool,placesError: freezed == placesError ? _self.placesError : placesError // ignore: cast_nullable_to_non_nullable
as String?,placesPage: null == placesPage ? _self.placesPage : placesPage // ignore: cast_nullable_to_non_nullable
as int,hasMorePlaces: null == hasMorePlaces ? _self.hasMorePlaces : hasMorePlaces // ignore: cast_nullable_to_non_nullable
as bool,selectedCategory: freezed == selectedCategory ? _self.selectedCategory : selectedCategory // ignore: cast_nullable_to_non_nullable
as String?,filterUserId: freezed == filterUserId ? _self.filterUserId : filterUserId // ignore: cast_nullable_to_non_nullable
as int?,filterUserName: freezed == filterUserName ? _self.filterUserName : filterUserName // ignore: cast_nullable_to_non_nullable
as String?,searchResults: null == searchResults ? _self.searchResults : searchResults // ignore: cast_nullable_to_non_nullable
as List<PlaceResponse>,isSearching: null == isSearching ? _self.isSearching : isSearching // ignore: cast_nullable_to_non_nullable
as bool,searchError: freezed == searchError ? _self.searchError : searchError // ignore: cast_nullable_to_non_nullable
as String?,placesSearchQuery: freezed == placesSearchQuery ? _self.placesSearchQuery : placesSearchQuery // ignore: cast_nullable_to_non_nullable
as String?,mapPlaces: null == mapPlaces ? _self.mapPlaces : mapPlaces // ignore: cast_nullable_to_non_nullable
as List<PlaceMapFeature>,isLoadingMapPlaces: null == isLoadingMapPlaces ? _self.isLoadingMapPlaces : isLoadingMapPlaces // ignore: cast_nullable_to_non_nullable
as bool,hotels: null == hotels ? _self.hotels : hotels // ignore: cast_nullable_to_non_nullable
as List<HotelResponse>,isLoadingHotels: null == isLoadingHotels ? _self.isLoadingHotels : isLoadingHotels // ignore: cast_nullable_to_non_nullable
as bool,hotelsError: freezed == hotelsError ? _self.hotelsError : hotelsError // ignore: cast_nullable_to_non_nullable
as String?,hotelsPage: null == hotelsPage ? _self.hotelsPage : hotelsPage // ignore: cast_nullable_to_non_nullable
as int,hasMoreHotels: null == hasMoreHotels ? _self.hasMoreHotels : hasMoreHotels // ignore: cast_nullable_to_non_nullable
as bool,mapHotels: null == mapHotels ? _self.mapHotels : mapHotels // ignore: cast_nullable_to_non_nullable
as List<PlaceMapFeature>,isLoadingMapHotels: null == isLoadingMapHotels ? _self.isLoadingMapHotels : isLoadingMapHotels // ignore: cast_nullable_to_non_nullable
as bool,guides: null == guides ? _self.guides : guides // ignore: cast_nullable_to_non_nullable
as List<GuideItemResponse>,isLoadingGuides: null == isLoadingGuides ? _self.isLoadingGuides : isLoadingGuides // ignore: cast_nullable_to_non_nullable
as bool,guidesError: freezed == guidesError ? _self.guidesError : guidesError // ignore: cast_nullable_to_non_nullable
as String?,guidesSort: null == guidesSort ? _self.guidesSort : guidesSort // ignore: cast_nullable_to_non_nullable
as String,galleryPhotos: null == galleryPhotos ? _self.galleryPhotos : galleryPhotos // ignore: cast_nullable_to_non_nullable
as List<PlacePhotoFeedItem>,isLoadingGallery: null == isLoadingGallery ? _self.isLoadingGallery : isLoadingGallery // ignore: cast_nullable_to_non_nullable
as bool,galleryError: freezed == galleryError ? _self.galleryError : galleryError // ignore: cast_nullable_to_non_nullable
as String?,galleryPage: null == galleryPage ? _self.galleryPage : galleryPage // ignore: cast_nullable_to_non_nullable
as int,hasMoreGalleryPhotos: null == hasMoreGalleryPhotos ? _self.hasMoreGalleryPhotos : hasMoreGalleryPhotos // ignore: cast_nullable_to_non_nullable
as bool,savedPlaces: null == savedPlaces ? _self.savedPlaces : savedPlaces // ignore: cast_nullable_to_non_nullable
as List<PlaceResponse>,isLoadingSavedPlaces: null == isLoadingSavedPlaces ? _self.isLoadingSavedPlaces : isLoadingSavedPlaces // ignore: cast_nullable_to_non_nullable
as bool,savedPlacesError: freezed == savedPlacesError ? _self.savedPlacesError : savedPlacesError // ignore: cast_nullable_to_non_nullable
as String?,savedPlacesPage: null == savedPlacesPage ? _self.savedPlacesPage : savedPlacesPage // ignore: cast_nullable_to_non_nullable
as int,hasMoreSavedPlaces: null == hasMoreSavedPlaces ? _self.hasMoreSavedPlaces : hasMoreSavedPlaces // ignore: cast_nullable_to_non_nullable
as bool,myContributions: null == myContributions ? _self.myContributions : myContributions // ignore: cast_nullable_to_non_nullable
as List<PlaceResponse>,isLoadingMyContributions: null == isLoadingMyContributions ? _self.isLoadingMyContributions : isLoadingMyContributions // ignore: cast_nullable_to_non_nullable
as bool,myContributionsError: freezed == myContributionsError ? _self.myContributionsError : myContributionsError // ignore: cast_nullable_to_non_nullable
as String?,myContributionsPage: null == myContributionsPage ? _self.myContributionsPage : myContributionsPage // ignore: cast_nullable_to_non_nullable
as int,hasMoreMyContributions: null == hasMoreMyContributions ? _self.hasMoreMyContributions : hasMoreMyContributions // ignore: cast_nullable_to_non_nullable
as bool,highlightedPlaceId: freezed == highlightedPlaceId ? _self.highlightedPlaceId : highlightedPlaceId // ignore: cast_nullable_to_non_nullable
as int?,highlightedHotelId: freezed == highlightedHotelId ? _self.highlightedHotelId : highlightedHotelId // ignore: cast_nullable_to_non_nullable
as int?,isPickingLocation: null == isPickingLocation ? _self.isPickingLocation : isPickingLocation // ignore: cast_nullable_to_non_nullable
as bool,pickedLat: freezed == pickedLat ? _self.pickedLat : pickedLat // ignore: cast_nullable_to_non_nullable
as double?,pickedLng: freezed == pickedLng ? _self.pickedLng : pickedLng // ignore: cast_nullable_to_non_nullable
as double?,isSubmittingPlace: null == isSubmittingPlace ? _self.isSubmittingPlace : isSubmittingPlace // ignore: cast_nullable_to_non_nullable
as bool,submitPlaceError: freezed == submitPlaceError ? _self.submitPlaceError : submitPlaceError // ignore: cast_nullable_to_non_nullable
as String?,submitPlaceSuccess: null == submitPlaceSuccess ? _self.submitPlaceSuccess : submitPlaceSuccess // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [MishwarState].
extension MishwarStatePatterns on MishwarState {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _MishwarState value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _MishwarState() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _MishwarState value)  $default,){
final _that = this;
switch (_that) {
case _MishwarState():
return $default(_that);}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _MishwarState value)?  $default,){
final _that = this;
switch (_that) {
case _MishwarState() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int selectedTabIndex,  bool isLoggedIn,  List<PlaceResponse> places,  bool isLoadingPlaces,  String? placesError,  int placesPage,  bool hasMorePlaces,  String? selectedCategory,  int? filterUserId,  String? filterUserName,  List<PlaceResponse> searchResults,  bool isSearching,  String? searchError,  String? placesSearchQuery,  List<PlaceMapFeature> mapPlaces,  bool isLoadingMapPlaces,  List<HotelResponse> hotels,  bool isLoadingHotels,  String? hotelsError,  int hotelsPage,  bool hasMoreHotels,  List<PlaceMapFeature> mapHotels,  bool isLoadingMapHotels,  List<GuideItemResponse> guides,  bool isLoadingGuides,  String? guidesError,  String guidesSort,  List<PlacePhotoFeedItem> galleryPhotos,  bool isLoadingGallery,  String? galleryError,  int galleryPage,  bool hasMoreGalleryPhotos,  List<PlaceResponse> savedPlaces,  bool isLoadingSavedPlaces,  String? savedPlacesError,  int savedPlacesPage,  bool hasMoreSavedPlaces,  List<PlaceResponse> myContributions,  bool isLoadingMyContributions,  String? myContributionsError,  int myContributionsPage,  bool hasMoreMyContributions,  int? highlightedPlaceId,  int? highlightedHotelId,  bool isPickingLocation,  double? pickedLat,  double? pickedLng,  bool isSubmittingPlace,  String? submitPlaceError,  bool submitPlaceSuccess)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _MishwarState() when $default != null:
return $default(_that.selectedTabIndex,_that.isLoggedIn,_that.places,_that.isLoadingPlaces,_that.placesError,_that.placesPage,_that.hasMorePlaces,_that.selectedCategory,_that.filterUserId,_that.filterUserName,_that.searchResults,_that.isSearching,_that.searchError,_that.placesSearchQuery,_that.mapPlaces,_that.isLoadingMapPlaces,_that.hotels,_that.isLoadingHotels,_that.hotelsError,_that.hotelsPage,_that.hasMoreHotels,_that.mapHotels,_that.isLoadingMapHotels,_that.guides,_that.isLoadingGuides,_that.guidesError,_that.guidesSort,_that.galleryPhotos,_that.isLoadingGallery,_that.galleryError,_that.galleryPage,_that.hasMoreGalleryPhotos,_that.savedPlaces,_that.isLoadingSavedPlaces,_that.savedPlacesError,_that.savedPlacesPage,_that.hasMoreSavedPlaces,_that.myContributions,_that.isLoadingMyContributions,_that.myContributionsError,_that.myContributionsPage,_that.hasMoreMyContributions,_that.highlightedPlaceId,_that.highlightedHotelId,_that.isPickingLocation,_that.pickedLat,_that.pickedLng,_that.isSubmittingPlace,_that.submitPlaceError,_that.submitPlaceSuccess);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int selectedTabIndex,  bool isLoggedIn,  List<PlaceResponse> places,  bool isLoadingPlaces,  String? placesError,  int placesPage,  bool hasMorePlaces,  String? selectedCategory,  int? filterUserId,  String? filterUserName,  List<PlaceResponse> searchResults,  bool isSearching,  String? searchError,  String? placesSearchQuery,  List<PlaceMapFeature> mapPlaces,  bool isLoadingMapPlaces,  List<HotelResponse> hotels,  bool isLoadingHotels,  String? hotelsError,  int hotelsPage,  bool hasMoreHotels,  List<PlaceMapFeature> mapHotels,  bool isLoadingMapHotels,  List<GuideItemResponse> guides,  bool isLoadingGuides,  String? guidesError,  String guidesSort,  List<PlacePhotoFeedItem> galleryPhotos,  bool isLoadingGallery,  String? galleryError,  int galleryPage,  bool hasMoreGalleryPhotos,  List<PlaceResponse> savedPlaces,  bool isLoadingSavedPlaces,  String? savedPlacesError,  int savedPlacesPage,  bool hasMoreSavedPlaces,  List<PlaceResponse> myContributions,  bool isLoadingMyContributions,  String? myContributionsError,  int myContributionsPage,  bool hasMoreMyContributions,  int? highlightedPlaceId,  int? highlightedHotelId,  bool isPickingLocation,  double? pickedLat,  double? pickedLng,  bool isSubmittingPlace,  String? submitPlaceError,  bool submitPlaceSuccess)  $default,) {final _that = this;
switch (_that) {
case _MishwarState():
return $default(_that.selectedTabIndex,_that.isLoggedIn,_that.places,_that.isLoadingPlaces,_that.placesError,_that.placesPage,_that.hasMorePlaces,_that.selectedCategory,_that.filterUserId,_that.filterUserName,_that.searchResults,_that.isSearching,_that.searchError,_that.placesSearchQuery,_that.mapPlaces,_that.isLoadingMapPlaces,_that.hotels,_that.isLoadingHotels,_that.hotelsError,_that.hotelsPage,_that.hasMoreHotels,_that.mapHotels,_that.isLoadingMapHotels,_that.guides,_that.isLoadingGuides,_that.guidesError,_that.guidesSort,_that.galleryPhotos,_that.isLoadingGallery,_that.galleryError,_that.galleryPage,_that.hasMoreGalleryPhotos,_that.savedPlaces,_that.isLoadingSavedPlaces,_that.savedPlacesError,_that.savedPlacesPage,_that.hasMoreSavedPlaces,_that.myContributions,_that.isLoadingMyContributions,_that.myContributionsError,_that.myContributionsPage,_that.hasMoreMyContributions,_that.highlightedPlaceId,_that.highlightedHotelId,_that.isPickingLocation,_that.pickedLat,_that.pickedLng,_that.isSubmittingPlace,_that.submitPlaceError,_that.submitPlaceSuccess);}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int selectedTabIndex,  bool isLoggedIn,  List<PlaceResponse> places,  bool isLoadingPlaces,  String? placesError,  int placesPage,  bool hasMorePlaces,  String? selectedCategory,  int? filterUserId,  String? filterUserName,  List<PlaceResponse> searchResults,  bool isSearching,  String? searchError,  String? placesSearchQuery,  List<PlaceMapFeature> mapPlaces,  bool isLoadingMapPlaces,  List<HotelResponse> hotels,  bool isLoadingHotels,  String? hotelsError,  int hotelsPage,  bool hasMoreHotels,  List<PlaceMapFeature> mapHotels,  bool isLoadingMapHotels,  List<GuideItemResponse> guides,  bool isLoadingGuides,  String? guidesError,  String guidesSort,  List<PlacePhotoFeedItem> galleryPhotos,  bool isLoadingGallery,  String? galleryError,  int galleryPage,  bool hasMoreGalleryPhotos,  List<PlaceResponse> savedPlaces,  bool isLoadingSavedPlaces,  String? savedPlacesError,  int savedPlacesPage,  bool hasMoreSavedPlaces,  List<PlaceResponse> myContributions,  bool isLoadingMyContributions,  String? myContributionsError,  int myContributionsPage,  bool hasMoreMyContributions,  int? highlightedPlaceId,  int? highlightedHotelId,  bool isPickingLocation,  double? pickedLat,  double? pickedLng,  bool isSubmittingPlace,  String? submitPlaceError,  bool submitPlaceSuccess)?  $default,) {final _that = this;
switch (_that) {
case _MishwarState() when $default != null:
return $default(_that.selectedTabIndex,_that.isLoggedIn,_that.places,_that.isLoadingPlaces,_that.placesError,_that.placesPage,_that.hasMorePlaces,_that.selectedCategory,_that.filterUserId,_that.filterUserName,_that.searchResults,_that.isSearching,_that.searchError,_that.placesSearchQuery,_that.mapPlaces,_that.isLoadingMapPlaces,_that.hotels,_that.isLoadingHotels,_that.hotelsError,_that.hotelsPage,_that.hasMoreHotels,_that.mapHotels,_that.isLoadingMapHotels,_that.guides,_that.isLoadingGuides,_that.guidesError,_that.guidesSort,_that.galleryPhotos,_that.isLoadingGallery,_that.galleryError,_that.galleryPage,_that.hasMoreGalleryPhotos,_that.savedPlaces,_that.isLoadingSavedPlaces,_that.savedPlacesError,_that.savedPlacesPage,_that.hasMoreSavedPlaces,_that.myContributions,_that.isLoadingMyContributions,_that.myContributionsError,_that.myContributionsPage,_that.hasMoreMyContributions,_that.highlightedPlaceId,_that.highlightedHotelId,_that.isPickingLocation,_that.pickedLat,_that.pickedLng,_that.isSubmittingPlace,_that.submitPlaceError,_that.submitPlaceSuccess);case _:
  return null;

}
}

}

/// @nodoc


class _MishwarState implements MishwarState {
   _MishwarState({this.selectedTabIndex = 0, this.isLoggedIn = false, final  List<PlaceResponse> places = const [], this.isLoadingPlaces = false, this.placesError, this.placesPage = 1, this.hasMorePlaces = true, this.selectedCategory, this.filterUserId, this.filterUserName, final  List<PlaceResponse> searchResults = const [], this.isSearching = false, this.searchError, this.placesSearchQuery, final  List<PlaceMapFeature> mapPlaces = const [], this.isLoadingMapPlaces = false, final  List<HotelResponse> hotels = const [], this.isLoadingHotels = false, this.hotelsError, this.hotelsPage = 1, this.hasMoreHotels = true, final  List<PlaceMapFeature> mapHotels = const [], this.isLoadingMapHotels = false, final  List<GuideItemResponse> guides = const [], this.isLoadingGuides = false, this.guidesError, this.guidesSort = 'points', final  List<PlacePhotoFeedItem> galleryPhotos = const [], this.isLoadingGallery = false, this.galleryError, this.galleryPage = 1, this.hasMoreGalleryPhotos = true, final  List<PlaceResponse> savedPlaces = const [], this.isLoadingSavedPlaces = false, this.savedPlacesError, this.savedPlacesPage = 1, this.hasMoreSavedPlaces = true, final  List<PlaceResponse> myContributions = const [], this.isLoadingMyContributions = false, this.myContributionsError, this.myContributionsPage = 1, this.hasMoreMyContributions = true, this.highlightedPlaceId, this.highlightedHotelId, this.isPickingLocation = false, this.pickedLat, this.pickedLng, this.isSubmittingPlace = false, this.submitPlaceError, this.submitPlaceSuccess = false}): _places = places,_searchResults = searchResults,_mapPlaces = mapPlaces,_hotels = hotels,_mapHotels = mapHotels,_guides = guides,_galleryPhotos = galleryPhotos,_savedPlaces = savedPlaces,_myContributions = myContributions;
  

@override@JsonKey() final  int selectedTabIndex;
@override@JsonKey() final  bool isLoggedIn;
// Places tab
 final  List<PlaceResponse> _places;
// Places tab
@override@JsonKey() List<PlaceResponse> get places {
  if (_places is EqualUnmodifiableListView) return _places;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_places);
}

@override@JsonKey() final  bool isLoadingPlaces;
@override final  String? placesError;
@override@JsonKey() final  int placesPage;
@override@JsonKey() final  bool hasMorePlaces;
@override final  String? selectedCategory;
@override final  int? filterUserId;
@override final  String? filterUserName;
// Places Search (isolated to search bar)
 final  List<PlaceResponse> _searchResults;
// Places Search (isolated to search bar)
@override@JsonKey() List<PlaceResponse> get searchResults {
  if (_searchResults is EqualUnmodifiableListView) return _searchResults;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_searchResults);
}

@override@JsonKey() final  bool isSearching;
@override final  String? searchError;
@override final  String? placesSearchQuery;
// Places Map
 final  List<PlaceMapFeature> _mapPlaces;
// Places Map
@override@JsonKey() List<PlaceMapFeature> get mapPlaces {
  if (_mapPlaces is EqualUnmodifiableListView) return _mapPlaces;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_mapPlaces);
}

@override@JsonKey() final  bool isLoadingMapPlaces;
// Hotels tab
 final  List<HotelResponse> _hotels;
// Hotels tab
@override@JsonKey() List<HotelResponse> get hotels {
  if (_hotels is EqualUnmodifiableListView) return _hotels;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_hotels);
}

@override@JsonKey() final  bool isLoadingHotels;
@override final  String? hotelsError;
@override@JsonKey() final  int hotelsPage;
@override@JsonKey() final  bool hasMoreHotels;
// Hotels Map
 final  List<PlaceMapFeature> _mapHotels;
// Hotels Map
@override@JsonKey() List<PlaceMapFeature> get mapHotels {
  if (_mapHotels is EqualUnmodifiableListView) return _mapHotels;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_mapHotels);
}

@override@JsonKey() final  bool isLoadingMapHotels;
// Guides tab
 final  List<GuideItemResponse> _guides;
// Guides tab
@override@JsonKey() List<GuideItemResponse> get guides {
  if (_guides is EqualUnmodifiableListView) return _guides;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_guides);
}

@override@JsonKey() final  bool isLoadingGuides;
@override final  String? guidesError;
@override@JsonKey() final  String guidesSort;
// Gallery tab 
 final  List<PlacePhotoFeedItem> _galleryPhotos;
// Gallery tab 
@override@JsonKey() List<PlacePhotoFeedItem> get galleryPhotos {
  if (_galleryPhotos is EqualUnmodifiableListView) return _galleryPhotos;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_galleryPhotos);
}

@override@JsonKey() final  bool isLoadingGallery;
@override final  String? galleryError;
@override@JsonKey() final  int galleryPage;
@override@JsonKey() final  bool hasMoreGalleryPhotos;
// Saved places tab (محفوظاتي)
 final  List<PlaceResponse> _savedPlaces;
// Saved places tab (محفوظاتي)
@override@JsonKey() List<PlaceResponse> get savedPlaces {
  if (_savedPlaces is EqualUnmodifiableListView) return _savedPlaces;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_savedPlaces);
}

@override@JsonKey() final  bool isLoadingSavedPlaces;
@override final  String? savedPlacesError;
@override@JsonKey() final  int savedPlacesPage;
@override@JsonKey() final  bool hasMoreSavedPlaces;
// My contributions tab (مساهماتي)
 final  List<PlaceResponse> _myContributions;
// My contributions tab (مساهماتي)
@override@JsonKey() List<PlaceResponse> get myContributions {
  if (_myContributions is EqualUnmodifiableListView) return _myContributions;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_myContributions);
}

@override@JsonKey() final  bool isLoadingMyContributions;
@override final  String? myContributionsError;
@override@JsonKey() final  int myContributionsPage;
@override@JsonKey() final  bool hasMoreMyContributions;
// Map highlights
@override final  int? highlightedPlaceId;
@override final  int? highlightedHotelId;
// Add place flow
@override@JsonKey() final  bool isPickingLocation;
@override final  double? pickedLat;
@override final  double? pickedLng;
@override@JsonKey() final  bool isSubmittingPlace;
@override final  String? submitPlaceError;
@override@JsonKey() final  bool submitPlaceSuccess;

/// Create a copy of MishwarState
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$MishwarStateCopyWith<_MishwarState> get copyWith => __$MishwarStateCopyWithImpl<_MishwarState>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _MishwarState&&(identical(other.selectedTabIndex, selectedTabIndex) || other.selectedTabIndex == selectedTabIndex)&&(identical(other.isLoggedIn, isLoggedIn) || other.isLoggedIn == isLoggedIn)&&const DeepCollectionEquality().equals(other._places, _places)&&(identical(other.isLoadingPlaces, isLoadingPlaces) || other.isLoadingPlaces == isLoadingPlaces)&&(identical(other.placesError, placesError) || other.placesError == placesError)&&(identical(other.placesPage, placesPage) || other.placesPage == placesPage)&&(identical(other.hasMorePlaces, hasMorePlaces) || other.hasMorePlaces == hasMorePlaces)&&(identical(other.selectedCategory, selectedCategory) || other.selectedCategory == selectedCategory)&&(identical(other.filterUserId, filterUserId) || other.filterUserId == filterUserId)&&(identical(other.filterUserName, filterUserName) || other.filterUserName == filterUserName)&&const DeepCollectionEquality().equals(other._searchResults, _searchResults)&&(identical(other.isSearching, isSearching) || other.isSearching == isSearching)&&(identical(other.searchError, searchError) || other.searchError == searchError)&&(identical(other.placesSearchQuery, placesSearchQuery) || other.placesSearchQuery == placesSearchQuery)&&const DeepCollectionEquality().equals(other._mapPlaces, _mapPlaces)&&(identical(other.isLoadingMapPlaces, isLoadingMapPlaces) || other.isLoadingMapPlaces == isLoadingMapPlaces)&&const DeepCollectionEquality().equals(other._hotels, _hotels)&&(identical(other.isLoadingHotels, isLoadingHotels) || other.isLoadingHotels == isLoadingHotels)&&(identical(other.hotelsError, hotelsError) || other.hotelsError == hotelsError)&&(identical(other.hotelsPage, hotelsPage) || other.hotelsPage == hotelsPage)&&(identical(other.hasMoreHotels, hasMoreHotels) || other.hasMoreHotels == hasMoreHotels)&&const DeepCollectionEquality().equals(other._mapHotels, _mapHotels)&&(identical(other.isLoadingMapHotels, isLoadingMapHotels) || other.isLoadingMapHotels == isLoadingMapHotels)&&const DeepCollectionEquality().equals(other._guides, _guides)&&(identical(other.isLoadingGuides, isLoadingGuides) || other.isLoadingGuides == isLoadingGuides)&&(identical(other.guidesError, guidesError) || other.guidesError == guidesError)&&(identical(other.guidesSort, guidesSort) || other.guidesSort == guidesSort)&&const DeepCollectionEquality().equals(other._galleryPhotos, _galleryPhotos)&&(identical(other.isLoadingGallery, isLoadingGallery) || other.isLoadingGallery == isLoadingGallery)&&(identical(other.galleryError, galleryError) || other.galleryError == galleryError)&&(identical(other.galleryPage, galleryPage) || other.galleryPage == galleryPage)&&(identical(other.hasMoreGalleryPhotos, hasMoreGalleryPhotos) || other.hasMoreGalleryPhotos == hasMoreGalleryPhotos)&&const DeepCollectionEquality().equals(other._savedPlaces, _savedPlaces)&&(identical(other.isLoadingSavedPlaces, isLoadingSavedPlaces) || other.isLoadingSavedPlaces == isLoadingSavedPlaces)&&(identical(other.savedPlacesError, savedPlacesError) || other.savedPlacesError == savedPlacesError)&&(identical(other.savedPlacesPage, savedPlacesPage) || other.savedPlacesPage == savedPlacesPage)&&(identical(other.hasMoreSavedPlaces, hasMoreSavedPlaces) || other.hasMoreSavedPlaces == hasMoreSavedPlaces)&&const DeepCollectionEquality().equals(other._myContributions, _myContributions)&&(identical(other.isLoadingMyContributions, isLoadingMyContributions) || other.isLoadingMyContributions == isLoadingMyContributions)&&(identical(other.myContributionsError, myContributionsError) || other.myContributionsError == myContributionsError)&&(identical(other.myContributionsPage, myContributionsPage) || other.myContributionsPage == myContributionsPage)&&(identical(other.hasMoreMyContributions, hasMoreMyContributions) || other.hasMoreMyContributions == hasMoreMyContributions)&&(identical(other.highlightedPlaceId, highlightedPlaceId) || other.highlightedPlaceId == highlightedPlaceId)&&(identical(other.highlightedHotelId, highlightedHotelId) || other.highlightedHotelId == highlightedHotelId)&&(identical(other.isPickingLocation, isPickingLocation) || other.isPickingLocation == isPickingLocation)&&(identical(other.pickedLat, pickedLat) || other.pickedLat == pickedLat)&&(identical(other.pickedLng, pickedLng) || other.pickedLng == pickedLng)&&(identical(other.isSubmittingPlace, isSubmittingPlace) || other.isSubmittingPlace == isSubmittingPlace)&&(identical(other.submitPlaceError, submitPlaceError) || other.submitPlaceError == submitPlaceError)&&(identical(other.submitPlaceSuccess, submitPlaceSuccess) || other.submitPlaceSuccess == submitPlaceSuccess));
}


@override
int get hashCode => Object.hashAll([runtimeType,selectedTabIndex,isLoggedIn,const DeepCollectionEquality().hash(_places),isLoadingPlaces,placesError,placesPage,hasMorePlaces,selectedCategory,filterUserId,filterUserName,const DeepCollectionEquality().hash(_searchResults),isSearching,searchError,placesSearchQuery,const DeepCollectionEquality().hash(_mapPlaces),isLoadingMapPlaces,const DeepCollectionEquality().hash(_hotels),isLoadingHotels,hotelsError,hotelsPage,hasMoreHotels,const DeepCollectionEquality().hash(_mapHotels),isLoadingMapHotels,const DeepCollectionEquality().hash(_guides),isLoadingGuides,guidesError,guidesSort,const DeepCollectionEquality().hash(_galleryPhotos),isLoadingGallery,galleryError,galleryPage,hasMoreGalleryPhotos,const DeepCollectionEquality().hash(_savedPlaces),isLoadingSavedPlaces,savedPlacesError,savedPlacesPage,hasMoreSavedPlaces,const DeepCollectionEquality().hash(_myContributions),isLoadingMyContributions,myContributionsError,myContributionsPage,hasMoreMyContributions,highlightedPlaceId,highlightedHotelId,isPickingLocation,pickedLat,pickedLng,isSubmittingPlace,submitPlaceError,submitPlaceSuccess]);

@override
String toString() {
  return 'MishwarState(selectedTabIndex: $selectedTabIndex, isLoggedIn: $isLoggedIn, places: $places, isLoadingPlaces: $isLoadingPlaces, placesError: $placesError, placesPage: $placesPage, hasMorePlaces: $hasMorePlaces, selectedCategory: $selectedCategory, filterUserId: $filterUserId, filterUserName: $filterUserName, searchResults: $searchResults, isSearching: $isSearching, searchError: $searchError, placesSearchQuery: $placesSearchQuery, mapPlaces: $mapPlaces, isLoadingMapPlaces: $isLoadingMapPlaces, hotels: $hotels, isLoadingHotels: $isLoadingHotels, hotelsError: $hotelsError, hotelsPage: $hotelsPage, hasMoreHotels: $hasMoreHotels, mapHotels: $mapHotels, isLoadingMapHotels: $isLoadingMapHotels, guides: $guides, isLoadingGuides: $isLoadingGuides, guidesError: $guidesError, guidesSort: $guidesSort, galleryPhotos: $galleryPhotos, isLoadingGallery: $isLoadingGallery, galleryError: $galleryError, galleryPage: $galleryPage, hasMoreGalleryPhotos: $hasMoreGalleryPhotos, savedPlaces: $savedPlaces, isLoadingSavedPlaces: $isLoadingSavedPlaces, savedPlacesError: $savedPlacesError, savedPlacesPage: $savedPlacesPage, hasMoreSavedPlaces: $hasMoreSavedPlaces, myContributions: $myContributions, isLoadingMyContributions: $isLoadingMyContributions, myContributionsError: $myContributionsError, myContributionsPage: $myContributionsPage, hasMoreMyContributions: $hasMoreMyContributions, highlightedPlaceId: $highlightedPlaceId, highlightedHotelId: $highlightedHotelId, isPickingLocation: $isPickingLocation, pickedLat: $pickedLat, pickedLng: $pickedLng, isSubmittingPlace: $isSubmittingPlace, submitPlaceError: $submitPlaceError, submitPlaceSuccess: $submitPlaceSuccess)';
}


}

/// @nodoc
abstract mixin class _$MishwarStateCopyWith<$Res> implements $MishwarStateCopyWith<$Res> {
  factory _$MishwarStateCopyWith(_MishwarState value, $Res Function(_MishwarState) _then) = __$MishwarStateCopyWithImpl;
@override @useResult
$Res call({
 int selectedTabIndex, bool isLoggedIn, List<PlaceResponse> places, bool isLoadingPlaces, String? placesError, int placesPage, bool hasMorePlaces, String? selectedCategory, int? filterUserId, String? filterUserName, List<PlaceResponse> searchResults, bool isSearching, String? searchError, String? placesSearchQuery, List<PlaceMapFeature> mapPlaces, bool isLoadingMapPlaces, List<HotelResponse> hotels, bool isLoadingHotels, String? hotelsError, int hotelsPage, bool hasMoreHotels, List<PlaceMapFeature> mapHotels, bool isLoadingMapHotels, List<GuideItemResponse> guides, bool isLoadingGuides, String? guidesError, String guidesSort, List<PlacePhotoFeedItem> galleryPhotos, bool isLoadingGallery, String? galleryError, int galleryPage, bool hasMoreGalleryPhotos, List<PlaceResponse> savedPlaces, bool isLoadingSavedPlaces, String? savedPlacesError, int savedPlacesPage, bool hasMoreSavedPlaces, List<PlaceResponse> myContributions, bool isLoadingMyContributions, String? myContributionsError, int myContributionsPage, bool hasMoreMyContributions, int? highlightedPlaceId, int? highlightedHotelId, bool isPickingLocation, double? pickedLat, double? pickedLng, bool isSubmittingPlace, String? submitPlaceError, bool submitPlaceSuccess
});




}
/// @nodoc
class __$MishwarStateCopyWithImpl<$Res>
    implements _$MishwarStateCopyWith<$Res> {
  __$MishwarStateCopyWithImpl(this._self, this._then);

  final _MishwarState _self;
  final $Res Function(_MishwarState) _then;

/// Create a copy of MishwarState
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? selectedTabIndex = null,Object? isLoggedIn = null,Object? places = null,Object? isLoadingPlaces = null,Object? placesError = freezed,Object? placesPage = null,Object? hasMorePlaces = null,Object? selectedCategory = freezed,Object? filterUserId = freezed,Object? filterUserName = freezed,Object? searchResults = null,Object? isSearching = null,Object? searchError = freezed,Object? placesSearchQuery = freezed,Object? mapPlaces = null,Object? isLoadingMapPlaces = null,Object? hotels = null,Object? isLoadingHotels = null,Object? hotelsError = freezed,Object? hotelsPage = null,Object? hasMoreHotels = null,Object? mapHotels = null,Object? isLoadingMapHotels = null,Object? guides = null,Object? isLoadingGuides = null,Object? guidesError = freezed,Object? guidesSort = null,Object? galleryPhotos = null,Object? isLoadingGallery = null,Object? galleryError = freezed,Object? galleryPage = null,Object? hasMoreGalleryPhotos = null,Object? savedPlaces = null,Object? isLoadingSavedPlaces = null,Object? savedPlacesError = freezed,Object? savedPlacesPage = null,Object? hasMoreSavedPlaces = null,Object? myContributions = null,Object? isLoadingMyContributions = null,Object? myContributionsError = freezed,Object? myContributionsPage = null,Object? hasMoreMyContributions = null,Object? highlightedPlaceId = freezed,Object? highlightedHotelId = freezed,Object? isPickingLocation = null,Object? pickedLat = freezed,Object? pickedLng = freezed,Object? isSubmittingPlace = null,Object? submitPlaceError = freezed,Object? submitPlaceSuccess = null,}) {
  return _then(_MishwarState(
selectedTabIndex: null == selectedTabIndex ? _self.selectedTabIndex : selectedTabIndex // ignore: cast_nullable_to_non_nullable
as int,isLoggedIn: null == isLoggedIn ? _self.isLoggedIn : isLoggedIn // ignore: cast_nullable_to_non_nullable
as bool,places: null == places ? _self._places : places // ignore: cast_nullable_to_non_nullable
as List<PlaceResponse>,isLoadingPlaces: null == isLoadingPlaces ? _self.isLoadingPlaces : isLoadingPlaces // ignore: cast_nullable_to_non_nullable
as bool,placesError: freezed == placesError ? _self.placesError : placesError // ignore: cast_nullable_to_non_nullable
as String?,placesPage: null == placesPage ? _self.placesPage : placesPage // ignore: cast_nullable_to_non_nullable
as int,hasMorePlaces: null == hasMorePlaces ? _self.hasMorePlaces : hasMorePlaces // ignore: cast_nullable_to_non_nullable
as bool,selectedCategory: freezed == selectedCategory ? _self.selectedCategory : selectedCategory // ignore: cast_nullable_to_non_nullable
as String?,filterUserId: freezed == filterUserId ? _self.filterUserId : filterUserId // ignore: cast_nullable_to_non_nullable
as int?,filterUserName: freezed == filterUserName ? _self.filterUserName : filterUserName // ignore: cast_nullable_to_non_nullable
as String?,searchResults: null == searchResults ? _self._searchResults : searchResults // ignore: cast_nullable_to_non_nullable
as List<PlaceResponse>,isSearching: null == isSearching ? _self.isSearching : isSearching // ignore: cast_nullable_to_non_nullable
as bool,searchError: freezed == searchError ? _self.searchError : searchError // ignore: cast_nullable_to_non_nullable
as String?,placesSearchQuery: freezed == placesSearchQuery ? _self.placesSearchQuery : placesSearchQuery // ignore: cast_nullable_to_non_nullable
as String?,mapPlaces: null == mapPlaces ? _self._mapPlaces : mapPlaces // ignore: cast_nullable_to_non_nullable
as List<PlaceMapFeature>,isLoadingMapPlaces: null == isLoadingMapPlaces ? _self.isLoadingMapPlaces : isLoadingMapPlaces // ignore: cast_nullable_to_non_nullable
as bool,hotels: null == hotels ? _self._hotels : hotels // ignore: cast_nullable_to_non_nullable
as List<HotelResponse>,isLoadingHotels: null == isLoadingHotels ? _self.isLoadingHotels : isLoadingHotels // ignore: cast_nullable_to_non_nullable
as bool,hotelsError: freezed == hotelsError ? _self.hotelsError : hotelsError // ignore: cast_nullable_to_non_nullable
as String?,hotelsPage: null == hotelsPage ? _self.hotelsPage : hotelsPage // ignore: cast_nullable_to_non_nullable
as int,hasMoreHotels: null == hasMoreHotels ? _self.hasMoreHotels : hasMoreHotels // ignore: cast_nullable_to_non_nullable
as bool,mapHotels: null == mapHotels ? _self._mapHotels : mapHotels // ignore: cast_nullable_to_non_nullable
as List<PlaceMapFeature>,isLoadingMapHotels: null == isLoadingMapHotels ? _self.isLoadingMapHotels : isLoadingMapHotels // ignore: cast_nullable_to_non_nullable
as bool,guides: null == guides ? _self._guides : guides // ignore: cast_nullable_to_non_nullable
as List<GuideItemResponse>,isLoadingGuides: null == isLoadingGuides ? _self.isLoadingGuides : isLoadingGuides // ignore: cast_nullable_to_non_nullable
as bool,guidesError: freezed == guidesError ? _self.guidesError : guidesError // ignore: cast_nullable_to_non_nullable
as String?,guidesSort: null == guidesSort ? _self.guidesSort : guidesSort // ignore: cast_nullable_to_non_nullable
as String,galleryPhotos: null == galleryPhotos ? _self._galleryPhotos : galleryPhotos // ignore: cast_nullable_to_non_nullable
as List<PlacePhotoFeedItem>,isLoadingGallery: null == isLoadingGallery ? _self.isLoadingGallery : isLoadingGallery // ignore: cast_nullable_to_non_nullable
as bool,galleryError: freezed == galleryError ? _self.galleryError : galleryError // ignore: cast_nullable_to_non_nullable
as String?,galleryPage: null == galleryPage ? _self.galleryPage : galleryPage // ignore: cast_nullable_to_non_nullable
as int,hasMoreGalleryPhotos: null == hasMoreGalleryPhotos ? _self.hasMoreGalleryPhotos : hasMoreGalleryPhotos // ignore: cast_nullable_to_non_nullable
as bool,savedPlaces: null == savedPlaces ? _self._savedPlaces : savedPlaces // ignore: cast_nullable_to_non_nullable
as List<PlaceResponse>,isLoadingSavedPlaces: null == isLoadingSavedPlaces ? _self.isLoadingSavedPlaces : isLoadingSavedPlaces // ignore: cast_nullable_to_non_nullable
as bool,savedPlacesError: freezed == savedPlacesError ? _self.savedPlacesError : savedPlacesError // ignore: cast_nullable_to_non_nullable
as String?,savedPlacesPage: null == savedPlacesPage ? _self.savedPlacesPage : savedPlacesPage // ignore: cast_nullable_to_non_nullable
as int,hasMoreSavedPlaces: null == hasMoreSavedPlaces ? _self.hasMoreSavedPlaces : hasMoreSavedPlaces // ignore: cast_nullable_to_non_nullable
as bool,myContributions: null == myContributions ? _self._myContributions : myContributions // ignore: cast_nullable_to_non_nullable
as List<PlaceResponse>,isLoadingMyContributions: null == isLoadingMyContributions ? _self.isLoadingMyContributions : isLoadingMyContributions // ignore: cast_nullable_to_non_nullable
as bool,myContributionsError: freezed == myContributionsError ? _self.myContributionsError : myContributionsError // ignore: cast_nullable_to_non_nullable
as String?,myContributionsPage: null == myContributionsPage ? _self.myContributionsPage : myContributionsPage // ignore: cast_nullable_to_non_nullable
as int,hasMoreMyContributions: null == hasMoreMyContributions ? _self.hasMoreMyContributions : hasMoreMyContributions // ignore: cast_nullable_to_non_nullable
as bool,highlightedPlaceId: freezed == highlightedPlaceId ? _self.highlightedPlaceId : highlightedPlaceId // ignore: cast_nullable_to_non_nullable
as int?,highlightedHotelId: freezed == highlightedHotelId ? _self.highlightedHotelId : highlightedHotelId // ignore: cast_nullable_to_non_nullable
as int?,isPickingLocation: null == isPickingLocation ? _self.isPickingLocation : isPickingLocation // ignore: cast_nullable_to_non_nullable
as bool,pickedLat: freezed == pickedLat ? _self.pickedLat : pickedLat // ignore: cast_nullable_to_non_nullable
as double?,pickedLng: freezed == pickedLng ? _self.pickedLng : pickedLng // ignore: cast_nullable_to_non_nullable
as double?,isSubmittingPlace: null == isSubmittingPlace ? _self.isSubmittingPlace : isSubmittingPlace // ignore: cast_nullable_to_non_nullable
as bool,submitPlaceError: freezed == submitPlaceError ? _self.submitPlaceError : submitPlaceError // ignore: cast_nullable_to_non_nullable
as String?,submitPlaceSuccess: null == submitPlaceSuccess ? _self.submitPlaceSuccess : submitPlaceSuccess // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}

// dart format on
