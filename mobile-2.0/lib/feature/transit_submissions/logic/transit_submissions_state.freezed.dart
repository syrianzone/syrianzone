// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'transit_submissions_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$TransitSubmissionsState {

 bool get isLoading; List<RouteDraftItem> get submissions; String? get errorMessage; Set<int> get deletingIds; String? get actionError;
/// Create a copy of TransitSubmissionsState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$TransitSubmissionsStateCopyWith<TransitSubmissionsState> get copyWith => _$TransitSubmissionsStateCopyWithImpl<TransitSubmissionsState>(this as TransitSubmissionsState, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is TransitSubmissionsState&&(identical(other.isLoading, isLoading) || other.isLoading == isLoading)&&const DeepCollectionEquality().equals(other.submissions, submissions)&&(identical(other.errorMessage, errorMessage) || other.errorMessage == errorMessage)&&const DeepCollectionEquality().equals(other.deletingIds, deletingIds)&&(identical(other.actionError, actionError) || other.actionError == actionError));
}


@override
int get hashCode => Object.hash(runtimeType,isLoading,const DeepCollectionEquality().hash(submissions),errorMessage,const DeepCollectionEquality().hash(deletingIds),actionError);

@override
String toString() {
  return 'TransitSubmissionsState(isLoading: $isLoading, submissions: $submissions, errorMessage: $errorMessage, deletingIds: $deletingIds, actionError: $actionError)';
}


}

/// @nodoc
abstract mixin class $TransitSubmissionsStateCopyWith<$Res>  {
  factory $TransitSubmissionsStateCopyWith(TransitSubmissionsState value, $Res Function(TransitSubmissionsState) _then) = _$TransitSubmissionsStateCopyWithImpl;
@useResult
$Res call({
 bool isLoading, List<RouteDraftItem> submissions, String? errorMessage, Set<int> deletingIds, String? actionError
});




}
/// @nodoc
class _$TransitSubmissionsStateCopyWithImpl<$Res>
    implements $TransitSubmissionsStateCopyWith<$Res> {
  _$TransitSubmissionsStateCopyWithImpl(this._self, this._then);

  final TransitSubmissionsState _self;
  final $Res Function(TransitSubmissionsState) _then;

/// Create a copy of TransitSubmissionsState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? isLoading = null,Object? submissions = null,Object? errorMessage = freezed,Object? deletingIds = null,Object? actionError = freezed,}) {
  return _then(_self.copyWith(
isLoading: null == isLoading ? _self.isLoading : isLoading // ignore: cast_nullable_to_non_nullable
as bool,submissions: null == submissions ? _self.submissions : submissions // ignore: cast_nullable_to_non_nullable
as List<RouteDraftItem>,errorMessage: freezed == errorMessage ? _self.errorMessage : errorMessage // ignore: cast_nullable_to_non_nullable
as String?,deletingIds: null == deletingIds ? _self.deletingIds : deletingIds // ignore: cast_nullable_to_non_nullable
as Set<int>,actionError: freezed == actionError ? _self.actionError : actionError // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [TransitSubmissionsState].
extension TransitSubmissionsStatePatterns on TransitSubmissionsState {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _TransitSubmissionsState value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _TransitSubmissionsState() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _TransitSubmissionsState value)  $default,){
final _that = this;
switch (_that) {
case _TransitSubmissionsState():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _TransitSubmissionsState value)?  $default,){
final _that = this;
switch (_that) {
case _TransitSubmissionsState() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( bool isLoading,  List<RouteDraftItem> submissions,  String? errorMessage,  Set<int> deletingIds,  String? actionError)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _TransitSubmissionsState() when $default != null:
return $default(_that.isLoading,_that.submissions,_that.errorMessage,_that.deletingIds,_that.actionError);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( bool isLoading,  List<RouteDraftItem> submissions,  String? errorMessage,  Set<int> deletingIds,  String? actionError)  $default,) {final _that = this;
switch (_that) {
case _TransitSubmissionsState():
return $default(_that.isLoading,_that.submissions,_that.errorMessage,_that.deletingIds,_that.actionError);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( bool isLoading,  List<RouteDraftItem> submissions,  String? errorMessage,  Set<int> deletingIds,  String? actionError)?  $default,) {final _that = this;
switch (_that) {
case _TransitSubmissionsState() when $default != null:
return $default(_that.isLoading,_that.submissions,_that.errorMessage,_that.deletingIds,_that.actionError);case _:
  return null;

}
}

}

/// @nodoc


class _TransitSubmissionsState extends TransitSubmissionsState {
  const _TransitSubmissionsState({this.isLoading = false, final  List<RouteDraftItem> submissions = const [], this.errorMessage, final  Set<int> deletingIds = const {}, this.actionError}): _submissions = submissions,_deletingIds = deletingIds,super._();
  

@override@JsonKey() final  bool isLoading;
 final  List<RouteDraftItem> _submissions;
@override@JsonKey() List<RouteDraftItem> get submissions {
  if (_submissions is EqualUnmodifiableListView) return _submissions;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_submissions);
}

@override final  String? errorMessage;
 final  Set<int> _deletingIds;
@override@JsonKey() Set<int> get deletingIds {
  if (_deletingIds is EqualUnmodifiableSetView) return _deletingIds;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableSetView(_deletingIds);
}

@override final  String? actionError;

/// Create a copy of TransitSubmissionsState
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$TransitSubmissionsStateCopyWith<_TransitSubmissionsState> get copyWith => __$TransitSubmissionsStateCopyWithImpl<_TransitSubmissionsState>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _TransitSubmissionsState&&(identical(other.isLoading, isLoading) || other.isLoading == isLoading)&&const DeepCollectionEquality().equals(other._submissions, _submissions)&&(identical(other.errorMessage, errorMessage) || other.errorMessage == errorMessage)&&const DeepCollectionEquality().equals(other._deletingIds, _deletingIds)&&(identical(other.actionError, actionError) || other.actionError == actionError));
}


@override
int get hashCode => Object.hash(runtimeType,isLoading,const DeepCollectionEquality().hash(_submissions),errorMessage,const DeepCollectionEquality().hash(_deletingIds),actionError);

@override
String toString() {
  return 'TransitSubmissionsState(isLoading: $isLoading, submissions: $submissions, errorMessage: $errorMessage, deletingIds: $deletingIds, actionError: $actionError)';
}


}

/// @nodoc
abstract mixin class _$TransitSubmissionsStateCopyWith<$Res> implements $TransitSubmissionsStateCopyWith<$Res> {
  factory _$TransitSubmissionsStateCopyWith(_TransitSubmissionsState value, $Res Function(_TransitSubmissionsState) _then) = __$TransitSubmissionsStateCopyWithImpl;
@override @useResult
$Res call({
 bool isLoading, List<RouteDraftItem> submissions, String? errorMessage, Set<int> deletingIds, String? actionError
});




}
/// @nodoc
class __$TransitSubmissionsStateCopyWithImpl<$Res>
    implements _$TransitSubmissionsStateCopyWith<$Res> {
  __$TransitSubmissionsStateCopyWithImpl(this._self, this._then);

  final _TransitSubmissionsState _self;
  final $Res Function(_TransitSubmissionsState) _then;

/// Create a copy of TransitSubmissionsState
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? isLoading = null,Object? submissions = null,Object? errorMessage = freezed,Object? deletingIds = null,Object? actionError = freezed,}) {
  return _then(_TransitSubmissionsState(
isLoading: null == isLoading ? _self.isLoading : isLoading // ignore: cast_nullable_to_non_nullable
as bool,submissions: null == submissions ? _self._submissions : submissions // ignore: cast_nullable_to_non_nullable
as List<RouteDraftItem>,errorMessage: freezed == errorMessage ? _self.errorMessage : errorMessage // ignore: cast_nullable_to_non_nullable
as String?,deletingIds: null == deletingIds ? _self._deletingIds : deletingIds // ignore: cast_nullable_to_non_nullable
as Set<int>,actionError: freezed == actionError ? _self.actionError : actionError // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}

// dart format on
