// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'transit_studio_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$TransitStudioState {

 bool get isLoadingCities; List<CityResponse> get cities; String? get citiesError; CityResponse? get selectedCity; bool get isLoadingMapData; MapDataResponse? get cityMapData; String? get mapDataError; StudioToolMode get activeTool; List<GeoPoint> get roadPoints; int? get selectedPointIndex; List<StudioStop> get stops; int get selectedColorIndex; bool get isSubmitting; bool get submitSuccess; String? get errorMessage; String? get successMessage; int? get expandSectionIndex; int? get editingDraftId; String? get editingDraftTitle;
/// Create a copy of TransitStudioState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$TransitStudioStateCopyWith<TransitStudioState> get copyWith => _$TransitStudioStateCopyWithImpl<TransitStudioState>(this as TransitStudioState, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is TransitStudioState&&(identical(other.isLoadingCities, isLoadingCities) || other.isLoadingCities == isLoadingCities)&&const DeepCollectionEquality().equals(other.cities, cities)&&(identical(other.citiesError, citiesError) || other.citiesError == citiesError)&&(identical(other.selectedCity, selectedCity) || other.selectedCity == selectedCity)&&(identical(other.isLoadingMapData, isLoadingMapData) || other.isLoadingMapData == isLoadingMapData)&&(identical(other.cityMapData, cityMapData) || other.cityMapData == cityMapData)&&(identical(other.mapDataError, mapDataError) || other.mapDataError == mapDataError)&&(identical(other.activeTool, activeTool) || other.activeTool == activeTool)&&const DeepCollectionEquality().equals(other.roadPoints, roadPoints)&&(identical(other.selectedPointIndex, selectedPointIndex) || other.selectedPointIndex == selectedPointIndex)&&const DeepCollectionEquality().equals(other.stops, stops)&&(identical(other.selectedColorIndex, selectedColorIndex) || other.selectedColorIndex == selectedColorIndex)&&(identical(other.isSubmitting, isSubmitting) || other.isSubmitting == isSubmitting)&&(identical(other.submitSuccess, submitSuccess) || other.submitSuccess == submitSuccess)&&(identical(other.errorMessage, errorMessage) || other.errorMessage == errorMessage)&&(identical(other.successMessage, successMessage) || other.successMessage == successMessage)&&(identical(other.expandSectionIndex, expandSectionIndex) || other.expandSectionIndex == expandSectionIndex)&&(identical(other.editingDraftId, editingDraftId) || other.editingDraftId == editingDraftId)&&(identical(other.editingDraftTitle, editingDraftTitle) || other.editingDraftTitle == editingDraftTitle));
}


@override
int get hashCode => Object.hashAll([runtimeType,isLoadingCities,const DeepCollectionEquality().hash(cities),citiesError,selectedCity,isLoadingMapData,cityMapData,mapDataError,activeTool,const DeepCollectionEquality().hash(roadPoints),selectedPointIndex,const DeepCollectionEquality().hash(stops),selectedColorIndex,isSubmitting,submitSuccess,errorMessage,successMessage,expandSectionIndex,editingDraftId,editingDraftTitle]);

@override
String toString() {
  return 'TransitStudioState(isLoadingCities: $isLoadingCities, cities: $cities, citiesError: $citiesError, selectedCity: $selectedCity, isLoadingMapData: $isLoadingMapData, cityMapData: $cityMapData, mapDataError: $mapDataError, activeTool: $activeTool, roadPoints: $roadPoints, selectedPointIndex: $selectedPointIndex, stops: $stops, selectedColorIndex: $selectedColorIndex, isSubmitting: $isSubmitting, submitSuccess: $submitSuccess, errorMessage: $errorMessage, successMessage: $successMessage, expandSectionIndex: $expandSectionIndex, editingDraftId: $editingDraftId, editingDraftTitle: $editingDraftTitle)';
}


}

/// @nodoc
abstract mixin class $TransitStudioStateCopyWith<$Res>  {
  factory $TransitStudioStateCopyWith(TransitStudioState value, $Res Function(TransitStudioState) _then) = _$TransitStudioStateCopyWithImpl;
@useResult
$Res call({
 bool isLoadingCities, List<CityResponse> cities, String? citiesError, CityResponse? selectedCity, bool isLoadingMapData, MapDataResponse? cityMapData, String? mapDataError, StudioToolMode activeTool, List<GeoPoint> roadPoints, int? selectedPointIndex, List<StudioStop> stops, int selectedColorIndex, bool isSubmitting, bool submitSuccess, String? errorMessage, String? successMessage, int? expandSectionIndex, int? editingDraftId, String? editingDraftTitle
});




}
/// @nodoc
class _$TransitStudioStateCopyWithImpl<$Res>
    implements $TransitStudioStateCopyWith<$Res> {
  _$TransitStudioStateCopyWithImpl(this._self, this._then);

  final TransitStudioState _self;
  final $Res Function(TransitStudioState) _then;

/// Create a copy of TransitStudioState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? isLoadingCities = null,Object? cities = null,Object? citiesError = freezed,Object? selectedCity = freezed,Object? isLoadingMapData = null,Object? cityMapData = freezed,Object? mapDataError = freezed,Object? activeTool = null,Object? roadPoints = null,Object? selectedPointIndex = freezed,Object? stops = null,Object? selectedColorIndex = null,Object? isSubmitting = null,Object? submitSuccess = null,Object? errorMessage = freezed,Object? successMessage = freezed,Object? expandSectionIndex = freezed,Object? editingDraftId = freezed,Object? editingDraftTitle = freezed,}) {
  return _then(_self.copyWith(
isLoadingCities: null == isLoadingCities ? _self.isLoadingCities : isLoadingCities // ignore: cast_nullable_to_non_nullable
as bool,cities: null == cities ? _self.cities : cities // ignore: cast_nullable_to_non_nullable
as List<CityResponse>,citiesError: freezed == citiesError ? _self.citiesError : citiesError // ignore: cast_nullable_to_non_nullable
as String?,selectedCity: freezed == selectedCity ? _self.selectedCity : selectedCity // ignore: cast_nullable_to_non_nullable
as CityResponse?,isLoadingMapData: null == isLoadingMapData ? _self.isLoadingMapData : isLoadingMapData // ignore: cast_nullable_to_non_nullable
as bool,cityMapData: freezed == cityMapData ? _self.cityMapData : cityMapData // ignore: cast_nullable_to_non_nullable
as MapDataResponse?,mapDataError: freezed == mapDataError ? _self.mapDataError : mapDataError // ignore: cast_nullable_to_non_nullable
as String?,activeTool: null == activeTool ? _self.activeTool : activeTool // ignore: cast_nullable_to_non_nullable
as StudioToolMode,roadPoints: null == roadPoints ? _self.roadPoints : roadPoints // ignore: cast_nullable_to_non_nullable
as List<GeoPoint>,selectedPointIndex: freezed == selectedPointIndex ? _self.selectedPointIndex : selectedPointIndex // ignore: cast_nullable_to_non_nullable
as int?,stops: null == stops ? _self.stops : stops // ignore: cast_nullable_to_non_nullable
as List<StudioStop>,selectedColorIndex: null == selectedColorIndex ? _self.selectedColorIndex : selectedColorIndex // ignore: cast_nullable_to_non_nullable
as int,isSubmitting: null == isSubmitting ? _self.isSubmitting : isSubmitting // ignore: cast_nullable_to_non_nullable
as bool,submitSuccess: null == submitSuccess ? _self.submitSuccess : submitSuccess // ignore: cast_nullable_to_non_nullable
as bool,errorMessage: freezed == errorMessage ? _self.errorMessage : errorMessage // ignore: cast_nullable_to_non_nullable
as String?,successMessage: freezed == successMessage ? _self.successMessage : successMessage // ignore: cast_nullable_to_non_nullable
as String?,expandSectionIndex: freezed == expandSectionIndex ? _self.expandSectionIndex : expandSectionIndex // ignore: cast_nullable_to_non_nullable
as int?,editingDraftId: freezed == editingDraftId ? _self.editingDraftId : editingDraftId // ignore: cast_nullable_to_non_nullable
as int?,editingDraftTitle: freezed == editingDraftTitle ? _self.editingDraftTitle : editingDraftTitle // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [TransitStudioState].
extension TransitStudioStatePatterns on TransitStudioState {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _TransitStudioState value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _TransitStudioState() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _TransitStudioState value)  $default,){
final _that = this;
switch (_that) {
case _TransitStudioState():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _TransitStudioState value)?  $default,){
final _that = this;
switch (_that) {
case _TransitStudioState() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( bool isLoadingCities,  List<CityResponse> cities,  String? citiesError,  CityResponse? selectedCity,  bool isLoadingMapData,  MapDataResponse? cityMapData,  String? mapDataError,  StudioToolMode activeTool,  List<GeoPoint> roadPoints,  int? selectedPointIndex,  List<StudioStop> stops,  int selectedColorIndex,  bool isSubmitting,  bool submitSuccess,  String? errorMessage,  String? successMessage,  int? expandSectionIndex,  int? editingDraftId,  String? editingDraftTitle)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _TransitStudioState() when $default != null:
return $default(_that.isLoadingCities,_that.cities,_that.citiesError,_that.selectedCity,_that.isLoadingMapData,_that.cityMapData,_that.mapDataError,_that.activeTool,_that.roadPoints,_that.selectedPointIndex,_that.stops,_that.selectedColorIndex,_that.isSubmitting,_that.submitSuccess,_that.errorMessage,_that.successMessage,_that.expandSectionIndex,_that.editingDraftId,_that.editingDraftTitle);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( bool isLoadingCities,  List<CityResponse> cities,  String? citiesError,  CityResponse? selectedCity,  bool isLoadingMapData,  MapDataResponse? cityMapData,  String? mapDataError,  StudioToolMode activeTool,  List<GeoPoint> roadPoints,  int? selectedPointIndex,  List<StudioStop> stops,  int selectedColorIndex,  bool isSubmitting,  bool submitSuccess,  String? errorMessage,  String? successMessage,  int? expandSectionIndex,  int? editingDraftId,  String? editingDraftTitle)  $default,) {final _that = this;
switch (_that) {
case _TransitStudioState():
return $default(_that.isLoadingCities,_that.cities,_that.citiesError,_that.selectedCity,_that.isLoadingMapData,_that.cityMapData,_that.mapDataError,_that.activeTool,_that.roadPoints,_that.selectedPointIndex,_that.stops,_that.selectedColorIndex,_that.isSubmitting,_that.submitSuccess,_that.errorMessage,_that.successMessage,_that.expandSectionIndex,_that.editingDraftId,_that.editingDraftTitle);case _:
  throw StateError('Unexpected subclass');

}
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( bool isLoadingCities,  List<CityResponse> cities,  String? citiesError,  CityResponse? selectedCity,  bool isLoadingMapData,  MapDataResponse? cityMapData,  String? mapDataError,  StudioToolMode activeTool,  List<GeoPoint> roadPoints,  int? selectedPointIndex,  List<StudioStop> stops,  int selectedColorIndex,  bool isSubmitting,  bool submitSuccess,  String? errorMessage,  String? successMessage,  int? expandSectionIndex,  int? editingDraftId,  String? editingDraftTitle)?  $default,) {final _that = this;
switch (_that) {
case _TransitStudioState() when $default != null:
return $default(_that.isLoadingCities,_that.cities,_that.citiesError,_that.selectedCity,_that.isLoadingMapData,_that.cityMapData,_that.mapDataError,_that.activeTool,_that.roadPoints,_that.selectedPointIndex,_that.stops,_that.selectedColorIndex,_that.isSubmitting,_that.submitSuccess,_that.errorMessage,_that.successMessage,_that.expandSectionIndex,_that.editingDraftId,_that.editingDraftTitle);case _:
  return null;

}
}

}

/// @nodoc


class _TransitStudioState extends TransitStudioState {
  const _TransitStudioState({this.isLoadingCities = false, final  List<CityResponse> cities = const [], this.citiesError, this.selectedCity, this.isLoadingMapData = false, this.cityMapData, this.mapDataError, this.activeTool = StudioToolMode.none, final  List<GeoPoint> roadPoints = const [], this.selectedPointIndex, final  List<StudioStop> stops = const [], this.selectedColorIndex = 0, this.isSubmitting = false, this.submitSuccess = false, this.errorMessage, this.successMessage, this.expandSectionIndex, this.editingDraftId, this.editingDraftTitle}): _cities = cities,_roadPoints = roadPoints,_stops = stops,super._();
  

@override@JsonKey() final  bool isLoadingCities;
 final  List<CityResponse> _cities;
@override@JsonKey() List<CityResponse> get cities {
  if (_cities is EqualUnmodifiableListView) return _cities;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_cities);
}

@override final  String? citiesError;
@override final  CityResponse? selectedCity;
@override@JsonKey() final  bool isLoadingMapData;
@override final  MapDataResponse? cityMapData;
@override final  String? mapDataError;
@override@JsonKey() final  StudioToolMode activeTool;
 final  List<GeoPoint> _roadPoints;
@override@JsonKey() List<GeoPoint> get roadPoints {
  if (_roadPoints is EqualUnmodifiableListView) return _roadPoints;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_roadPoints);
}

@override final  int? selectedPointIndex;
 final  List<StudioStop> _stops;
@override@JsonKey() List<StudioStop> get stops {
  if (_stops is EqualUnmodifiableListView) return _stops;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_stops);
}

@override@JsonKey() final  int selectedColorIndex;
@override@JsonKey() final  bool isSubmitting;
@override@JsonKey() final  bool submitSuccess;
@override final  String? errorMessage;
@override final  String? successMessage;
@override final  int? expandSectionIndex;
@override final  int? editingDraftId;
@override final  String? editingDraftTitle;

/// Create a copy of TransitStudioState
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$TransitStudioStateCopyWith<_TransitStudioState> get copyWith => __$TransitStudioStateCopyWithImpl<_TransitStudioState>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _TransitStudioState&&(identical(other.isLoadingCities, isLoadingCities) || other.isLoadingCities == isLoadingCities)&&const DeepCollectionEquality().equals(other._cities, _cities)&&(identical(other.citiesError, citiesError) || other.citiesError == citiesError)&&(identical(other.selectedCity, selectedCity) || other.selectedCity == selectedCity)&&(identical(other.isLoadingMapData, isLoadingMapData) || other.isLoadingMapData == isLoadingMapData)&&(identical(other.cityMapData, cityMapData) || other.cityMapData == cityMapData)&&(identical(other.mapDataError, mapDataError) || other.mapDataError == mapDataError)&&(identical(other.activeTool, activeTool) || other.activeTool == activeTool)&&const DeepCollectionEquality().equals(other._roadPoints, _roadPoints)&&(identical(other.selectedPointIndex, selectedPointIndex) || other.selectedPointIndex == selectedPointIndex)&&const DeepCollectionEquality().equals(other._stops, _stops)&&(identical(other.selectedColorIndex, selectedColorIndex) || other.selectedColorIndex == selectedColorIndex)&&(identical(other.isSubmitting, isSubmitting) || other.isSubmitting == isSubmitting)&&(identical(other.submitSuccess, submitSuccess) || other.submitSuccess == submitSuccess)&&(identical(other.errorMessage, errorMessage) || other.errorMessage == errorMessage)&&(identical(other.successMessage, successMessage) || other.successMessage == successMessage)&&(identical(other.expandSectionIndex, expandSectionIndex) || other.expandSectionIndex == expandSectionIndex)&&(identical(other.editingDraftId, editingDraftId) || other.editingDraftId == editingDraftId)&&(identical(other.editingDraftTitle, editingDraftTitle) || other.editingDraftTitle == editingDraftTitle));
}


@override
int get hashCode => Object.hashAll([runtimeType,isLoadingCities,const DeepCollectionEquality().hash(_cities),citiesError,selectedCity,isLoadingMapData,cityMapData,mapDataError,activeTool,const DeepCollectionEquality().hash(_roadPoints),selectedPointIndex,const DeepCollectionEquality().hash(_stops),selectedColorIndex,isSubmitting,submitSuccess,errorMessage,successMessage,expandSectionIndex,editingDraftId,editingDraftTitle]);

@override
String toString() {
  return 'TransitStudioState(isLoadingCities: $isLoadingCities, cities: $cities, citiesError: $citiesError, selectedCity: $selectedCity, isLoadingMapData: $isLoadingMapData, cityMapData: $cityMapData, mapDataError: $mapDataError, activeTool: $activeTool, roadPoints: $roadPoints, selectedPointIndex: $selectedPointIndex, stops: $stops, selectedColorIndex: $selectedColorIndex, isSubmitting: $isSubmitting, submitSuccess: $submitSuccess, errorMessage: $errorMessage, successMessage: $successMessage, expandSectionIndex: $expandSectionIndex, editingDraftId: $editingDraftId, editingDraftTitle: $editingDraftTitle)';
}


}

/// @nodoc
abstract mixin class _$TransitStudioStateCopyWith<$Res> implements $TransitStudioStateCopyWith<$Res> {
  factory _$TransitStudioStateCopyWith(_TransitStudioState value, $Res Function(_TransitStudioState) _then) = __$TransitStudioStateCopyWithImpl;
@override @useResult
$Res call({
 bool isLoadingCities, List<CityResponse> cities, String? citiesError, CityResponse? selectedCity, bool isLoadingMapData, MapDataResponse? cityMapData, String? mapDataError, StudioToolMode activeTool, List<GeoPoint> roadPoints, int? selectedPointIndex, List<StudioStop> stops, int selectedColorIndex, bool isSubmitting, bool submitSuccess, String? errorMessage, String? successMessage, int? expandSectionIndex, int? editingDraftId, String? editingDraftTitle
});




}
/// @nodoc
class __$TransitStudioStateCopyWithImpl<$Res>
    implements _$TransitStudioStateCopyWith<$Res> {
  __$TransitStudioStateCopyWithImpl(this._self, this._then);

  final _TransitStudioState _self;
  final $Res Function(_TransitStudioState) _then;

/// Create a copy of TransitStudioState
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? isLoadingCities = null,Object? cities = null,Object? citiesError = freezed,Object? selectedCity = freezed,Object? isLoadingMapData = null,Object? cityMapData = freezed,Object? mapDataError = freezed,Object? activeTool = null,Object? roadPoints = null,Object? selectedPointIndex = freezed,Object? stops = null,Object? selectedColorIndex = null,Object? isSubmitting = null,Object? submitSuccess = null,Object? errorMessage = freezed,Object? successMessage = freezed,Object? expandSectionIndex = freezed,Object? editingDraftId = freezed,Object? editingDraftTitle = freezed,}) {
  return _then(_TransitStudioState(
isLoadingCities: null == isLoadingCities ? _self.isLoadingCities : isLoadingCities // ignore: cast_nullable_to_non_nullable
as bool,cities: null == cities ? _self._cities : cities // ignore: cast_nullable_to_non_nullable
as List<CityResponse>,citiesError: freezed == citiesError ? _self.citiesError : citiesError // ignore: cast_nullable_to_non_nullable
as String?,selectedCity: freezed == selectedCity ? _self.selectedCity : selectedCity // ignore: cast_nullable_to_non_nullable
as CityResponse?,isLoadingMapData: null == isLoadingMapData ? _self.isLoadingMapData : isLoadingMapData // ignore: cast_nullable_to_non_nullable
as bool,cityMapData: freezed == cityMapData ? _self.cityMapData : cityMapData // ignore: cast_nullable_to_non_nullable
as MapDataResponse?,mapDataError: freezed == mapDataError ? _self.mapDataError : mapDataError // ignore: cast_nullable_to_non_nullable
as String?,activeTool: null == activeTool ? _self.activeTool : activeTool // ignore: cast_nullable_to_non_nullable
as StudioToolMode,roadPoints: null == roadPoints ? _self._roadPoints : roadPoints // ignore: cast_nullable_to_non_nullable
as List<GeoPoint>,selectedPointIndex: freezed == selectedPointIndex ? _self.selectedPointIndex : selectedPointIndex // ignore: cast_nullable_to_non_nullable
as int?,stops: null == stops ? _self._stops : stops // ignore: cast_nullable_to_non_nullable
as List<StudioStop>,selectedColorIndex: null == selectedColorIndex ? _self.selectedColorIndex : selectedColorIndex // ignore: cast_nullable_to_non_nullable
as int,isSubmitting: null == isSubmitting ? _self.isSubmitting : isSubmitting // ignore: cast_nullable_to_non_nullable
as bool,submitSuccess: null == submitSuccess ? _self.submitSuccess : submitSuccess // ignore: cast_nullable_to_non_nullable
as bool,errorMessage: freezed == errorMessage ? _self.errorMessage : errorMessage // ignore: cast_nullable_to_non_nullable
as String?,successMessage: freezed == successMessage ? _self.successMessage : successMessage // ignore: cast_nullable_to_non_nullable
as String?,expandSectionIndex: freezed == expandSectionIndex ? _self.expandSectionIndex : expandSectionIndex // ignore: cast_nullable_to_non_nullable
as int?,editingDraftId: freezed == editingDraftId ? _self.editingDraftId : editingDraftId // ignore: cast_nullable_to_non_nullable
as int?,editingDraftTitle: freezed == editingDraftTitle ? _self.editingDraftTitle : editingDraftTitle // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}

// dart format on
