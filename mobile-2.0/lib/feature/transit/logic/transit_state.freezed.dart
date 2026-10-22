// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'transit_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$TransitState {

 bool get isLoading; MapDataResponse? get mapData; String? get routesErrorMessage; String? get searchErrorMessage; TransitSearchResponse? get searchResults; bool get searchLoading; bool get nearbyLoading; List<NearbyStopResponse>? get nearbyStops; String? get nearbyErrorMessage;
/// Create a copy of TransitState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$TransitStateCopyWith<TransitState> get copyWith => _$TransitStateCopyWithImpl<TransitState>(this as TransitState, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is TransitState&&(identical(other.isLoading, isLoading) || other.isLoading == isLoading)&&(identical(other.mapData, mapData) || other.mapData == mapData)&&(identical(other.routesErrorMessage, routesErrorMessage) || other.routesErrorMessage == routesErrorMessage)&&(identical(other.searchErrorMessage, searchErrorMessage) || other.searchErrorMessage == searchErrorMessage)&&(identical(other.searchResults, searchResults) || other.searchResults == searchResults)&&(identical(other.searchLoading, searchLoading) || other.searchLoading == searchLoading)&&(identical(other.nearbyLoading, nearbyLoading) || other.nearbyLoading == nearbyLoading)&&const DeepCollectionEquality().equals(other.nearbyStops, nearbyStops)&&(identical(other.nearbyErrorMessage, nearbyErrorMessage) || other.nearbyErrorMessage == nearbyErrorMessage));
}


@override
int get hashCode => Object.hash(runtimeType,isLoading,mapData,routesErrorMessage,searchErrorMessage,searchResults,searchLoading,nearbyLoading,const DeepCollectionEquality().hash(nearbyStops),nearbyErrorMessage);

@override
String toString() {
  return 'TransitState(isLoading: $isLoading, mapData: $mapData, routesErrorMessage: $routesErrorMessage, searchErrorMessage: $searchErrorMessage, searchResults: $searchResults, searchLoading: $searchLoading, nearbyLoading: $nearbyLoading, nearbyStops: $nearbyStops, nearbyErrorMessage: $nearbyErrorMessage)';
}


}

/// @nodoc
abstract mixin class $TransitStateCopyWith<$Res>  {
  factory $TransitStateCopyWith(TransitState value, $Res Function(TransitState) _then) = _$TransitStateCopyWithImpl;
@useResult
$Res call({
 bool isLoading, MapDataResponse? mapData, String? routesErrorMessage, String? searchErrorMessage, TransitSearchResponse? searchResults, bool searchLoading, bool nearbyLoading, List<NearbyStopResponse>? nearbyStops, String? nearbyErrorMessage
});




}
/// @nodoc
class _$TransitStateCopyWithImpl<$Res>
    implements $TransitStateCopyWith<$Res> {
  _$TransitStateCopyWithImpl(this._self, this._then);

  final TransitState _self;
  final $Res Function(TransitState) _then;

/// Create a copy of TransitState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? isLoading = null,Object? mapData = freezed,Object? routesErrorMessage = freezed,Object? searchErrorMessage = freezed,Object? searchResults = freezed,Object? searchLoading = null,Object? nearbyLoading = null,Object? nearbyStops = freezed,Object? nearbyErrorMessage = freezed,}) {
  return _then(_self.copyWith(
isLoading: null == isLoading ? _self.isLoading : isLoading // ignore: cast_nullable_to_non_nullable
as bool,mapData: freezed == mapData ? _self.mapData : mapData // ignore: cast_nullable_to_non_nullable
as MapDataResponse?,routesErrorMessage: freezed == routesErrorMessage ? _self.routesErrorMessage : routesErrorMessage // ignore: cast_nullable_to_non_nullable
as String?,searchErrorMessage: freezed == searchErrorMessage ? _self.searchErrorMessage : searchErrorMessage // ignore: cast_nullable_to_non_nullable
as String?,searchResults: freezed == searchResults ? _self.searchResults : searchResults // ignore: cast_nullable_to_non_nullable
as TransitSearchResponse?,searchLoading: null == searchLoading ? _self.searchLoading : searchLoading // ignore: cast_nullable_to_non_nullable
as bool,nearbyLoading: null == nearbyLoading ? _self.nearbyLoading : nearbyLoading // ignore: cast_nullable_to_non_nullable
as bool,nearbyStops: freezed == nearbyStops ? _self.nearbyStops : nearbyStops // ignore: cast_nullable_to_non_nullable
as List<NearbyStopResponse>?,nearbyErrorMessage: freezed == nearbyErrorMessage ? _self.nearbyErrorMessage : nearbyErrorMessage // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [TransitState].
extension TransitStatePatterns on TransitState {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _TransitState value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _TransitState() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _TransitState value)  $default,){
final _that = this;
switch (_that) {
case _TransitState():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _TransitState value)?  $default,){
final _that = this;
switch (_that) {
case _TransitState() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( bool isLoading,  MapDataResponse? mapData,  String? routesErrorMessage,  String? searchErrorMessage,  TransitSearchResponse? searchResults,  bool searchLoading,  bool nearbyLoading,  List<NearbyStopResponse>? nearbyStops,  String? nearbyErrorMessage)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _TransitState() when $default != null:
return $default(_that.isLoading,_that.mapData,_that.routesErrorMessage,_that.searchErrorMessage,_that.searchResults,_that.searchLoading,_that.nearbyLoading,_that.nearbyStops,_that.nearbyErrorMessage);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( bool isLoading,  MapDataResponse? mapData,  String? routesErrorMessage,  String? searchErrorMessage,  TransitSearchResponse? searchResults,  bool searchLoading,  bool nearbyLoading,  List<NearbyStopResponse>? nearbyStops,  String? nearbyErrorMessage)  $default,) {final _that = this;
switch (_that) {
case _TransitState():
return $default(_that.isLoading,_that.mapData,_that.routesErrorMessage,_that.searchErrorMessage,_that.searchResults,_that.searchLoading,_that.nearbyLoading,_that.nearbyStops,_that.nearbyErrorMessage);}
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( bool isLoading,  MapDataResponse? mapData,  String? routesErrorMessage,  String? searchErrorMessage,  TransitSearchResponse? searchResults,  bool searchLoading,  bool nearbyLoading,  List<NearbyStopResponse>? nearbyStops,  String? nearbyErrorMessage)?  $default,) {final _that = this;
switch (_that) {
case _TransitState() when $default != null:
return $default(_that.isLoading,_that.mapData,_that.routesErrorMessage,_that.searchErrorMessage,_that.searchResults,_that.searchLoading,_that.nearbyLoading,_that.nearbyStops,_that.nearbyErrorMessage);case _:
  return null;

}
}

}

/// @nodoc


class _TransitState implements TransitState {
   _TransitState({this.isLoading = false, this.mapData, this.routesErrorMessage, this.searchErrorMessage, this.searchResults, this.searchLoading = false, this.nearbyLoading = false, final  List<NearbyStopResponse>? nearbyStops, this.nearbyErrorMessage}): _nearbyStops = nearbyStops;
  

@override@JsonKey() final  bool isLoading;
@override final  MapDataResponse? mapData;
@override final  String? routesErrorMessage;
@override final  String? searchErrorMessage;
@override final  TransitSearchResponse? searchResults;
@override@JsonKey() final  bool searchLoading;
@override@JsonKey() final  bool nearbyLoading;
 final  List<NearbyStopResponse>? _nearbyStops;
@override List<NearbyStopResponse>? get nearbyStops {
  final value = _nearbyStops;
  if (value == null) return null;
  if (_nearbyStops is EqualUnmodifiableListView) return _nearbyStops;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}

@override final  String? nearbyErrorMessage;

/// Create a copy of TransitState
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$TransitStateCopyWith<_TransitState> get copyWith => __$TransitStateCopyWithImpl<_TransitState>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _TransitState&&(identical(other.isLoading, isLoading) || other.isLoading == isLoading)&&(identical(other.mapData, mapData) || other.mapData == mapData)&&(identical(other.routesErrorMessage, routesErrorMessage) || other.routesErrorMessage == routesErrorMessage)&&(identical(other.searchErrorMessage, searchErrorMessage) || other.searchErrorMessage == searchErrorMessage)&&(identical(other.searchResults, searchResults) || other.searchResults == searchResults)&&(identical(other.searchLoading, searchLoading) || other.searchLoading == searchLoading)&&(identical(other.nearbyLoading, nearbyLoading) || other.nearbyLoading == nearbyLoading)&&const DeepCollectionEquality().equals(other._nearbyStops, _nearbyStops)&&(identical(other.nearbyErrorMessage, nearbyErrorMessage) || other.nearbyErrorMessage == nearbyErrorMessage));
}


@override
int get hashCode => Object.hash(runtimeType,isLoading,mapData,routesErrorMessage,searchErrorMessage,searchResults,searchLoading,nearbyLoading,const DeepCollectionEquality().hash(_nearbyStops),nearbyErrorMessage);

@override
String toString() {
  return 'TransitState(isLoading: $isLoading, mapData: $mapData, routesErrorMessage: $routesErrorMessage, searchErrorMessage: $searchErrorMessage, searchResults: $searchResults, searchLoading: $searchLoading, nearbyLoading: $nearbyLoading, nearbyStops: $nearbyStops, nearbyErrorMessage: $nearbyErrorMessage)';
}


}

/// @nodoc
abstract mixin class _$TransitStateCopyWith<$Res> implements $TransitStateCopyWith<$Res> {
  factory _$TransitStateCopyWith(_TransitState value, $Res Function(_TransitState) _then) = __$TransitStateCopyWithImpl;
@override @useResult
$Res call({
 bool isLoading, MapDataResponse? mapData, String? routesErrorMessage, String? searchErrorMessage, TransitSearchResponse? searchResults, bool searchLoading, bool nearbyLoading, List<NearbyStopResponse>? nearbyStops, String? nearbyErrorMessage
});




}
/// @nodoc
class __$TransitStateCopyWithImpl<$Res>
    implements _$TransitStateCopyWith<$Res> {
  __$TransitStateCopyWithImpl(this._self, this._then);

  final _TransitState _self;
  final $Res Function(_TransitState) _then;

/// Create a copy of TransitState
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? isLoading = null,Object? mapData = freezed,Object? routesErrorMessage = freezed,Object? searchErrorMessage = freezed,Object? searchResults = freezed,Object? searchLoading = null,Object? nearbyLoading = null,Object? nearbyStops = freezed,Object? nearbyErrorMessage = freezed,}) {
  return _then(_TransitState(
isLoading: null == isLoading ? _self.isLoading : isLoading // ignore: cast_nullable_to_non_nullable
as bool,mapData: freezed == mapData ? _self.mapData : mapData // ignore: cast_nullable_to_non_nullable
as MapDataResponse?,routesErrorMessage: freezed == routesErrorMessage ? _self.routesErrorMessage : routesErrorMessage // ignore: cast_nullable_to_non_nullable
as String?,searchErrorMessage: freezed == searchErrorMessage ? _self.searchErrorMessage : searchErrorMessage // ignore: cast_nullable_to_non_nullable
as String?,searchResults: freezed == searchResults ? _self.searchResults : searchResults // ignore: cast_nullable_to_non_nullable
as TransitSearchResponse?,searchLoading: null == searchLoading ? _self.searchLoading : searchLoading // ignore: cast_nullable_to_non_nullable
as bool,nearbyLoading: null == nearbyLoading ? _self.nearbyLoading : nearbyLoading // ignore: cast_nullable_to_non_nullable
as bool,nearbyStops: freezed == nearbyStops ? _self._nearbyStops : nearbyStops // ignore: cast_nullable_to_non_nullable
as List<NearbyStopResponse>?,nearbyErrorMessage: freezed == nearbyErrorMessage ? _self.nearbyErrorMessage : nearbyErrorMessage // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}

// dart format on
