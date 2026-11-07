// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'place_detail_response.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PlaceDetailResponse {

 int get id; String get name; String get category; String? get description; double get lat; double get lng;@JsonKey(name: 'thumb_url') String? get thumbUrl;@JsonKey(name: 'saves_count') int get savesCount; String? get status; PlaceAuthor? get user; List<PlacePhotoItem> get photos;@JsonKey(name: 'saved_by_me') bool? get savedByMe;@JsonKey(name: 'created_at') String? get createdAt;
/// Create a copy of PlaceDetailResponse
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PlaceDetailResponseCopyWith<PlaceDetailResponse> get copyWith => _$PlaceDetailResponseCopyWithImpl<PlaceDetailResponse>(this as PlaceDetailResponse, _$identity);

  /// Serializes this PlaceDetailResponse to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PlaceDetailResponse&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.category, category) || other.category == category)&&(identical(other.description, description) || other.description == description)&&(identical(other.lat, lat) || other.lat == lat)&&(identical(other.lng, lng) || other.lng == lng)&&(identical(other.thumbUrl, thumbUrl) || other.thumbUrl == thumbUrl)&&(identical(other.savesCount, savesCount) || other.savesCount == savesCount)&&(identical(other.status, status) || other.status == status)&&(identical(other.user, user) || other.user == user)&&const DeepCollectionEquality().equals(other.photos, photos)&&(identical(other.savedByMe, savedByMe) || other.savedByMe == savedByMe)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,category,description,lat,lng,thumbUrl,savesCount,status,user,const DeepCollectionEquality().hash(photos),savedByMe,createdAt);

@override
String toString() {
  return 'PlaceDetailResponse(id: $id, name: $name, category: $category, description: $description, lat: $lat, lng: $lng, thumbUrl: $thumbUrl, savesCount: $savesCount, status: $status, user: $user, photos: $photos, savedByMe: $savedByMe, createdAt: $createdAt)';
}


}

/// @nodoc
abstract mixin class $PlaceDetailResponseCopyWith<$Res>  {
  factory $PlaceDetailResponseCopyWith(PlaceDetailResponse value, $Res Function(PlaceDetailResponse) _then) = _$PlaceDetailResponseCopyWithImpl;
@useResult
$Res call({
 int id, String name, String category, String? description, double lat, double lng,@JsonKey(name: 'thumb_url') String? thumbUrl,@JsonKey(name: 'saves_count') int savesCount, String? status, PlaceAuthor? user, List<PlacePhotoItem> photos,@JsonKey(name: 'saved_by_me') bool? savedByMe,@JsonKey(name: 'created_at') String? createdAt
});




}
/// @nodoc
class _$PlaceDetailResponseCopyWithImpl<$Res>
    implements $PlaceDetailResponseCopyWith<$Res> {
  _$PlaceDetailResponseCopyWithImpl(this._self, this._then);

  final PlaceDetailResponse _self;
  final $Res Function(PlaceDetailResponse) _then;

/// Create a copy of PlaceDetailResponse
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? name = null,Object? category = null,Object? description = freezed,Object? lat = null,Object? lng = null,Object? thumbUrl = freezed,Object? savesCount = null,Object? status = freezed,Object? user = freezed,Object? photos = null,Object? savedByMe = freezed,Object? createdAt = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,category: null == category ? _self.category : category // ignore: cast_nullable_to_non_nullable
as String,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,lat: null == lat ? _self.lat : lat // ignore: cast_nullable_to_non_nullable
as double,lng: null == lng ? _self.lng : lng // ignore: cast_nullable_to_non_nullable
as double,thumbUrl: freezed == thumbUrl ? _self.thumbUrl : thumbUrl // ignore: cast_nullable_to_non_nullable
as String?,savesCount: null == savesCount ? _self.savesCount : savesCount // ignore: cast_nullable_to_non_nullable
as int,status: freezed == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String?,user: freezed == user ? _self.user : user // ignore: cast_nullable_to_non_nullable
as PlaceAuthor?,photos: null == photos ? _self.photos : photos // ignore: cast_nullable_to_non_nullable
as List<PlacePhotoItem>,savedByMe: freezed == savedByMe ? _self.savedByMe : savedByMe // ignore: cast_nullable_to_non_nullable
as bool?,createdAt: freezed == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [PlaceDetailResponse].
extension PlaceDetailResponsePatterns on PlaceDetailResponse {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PlaceDetailResponse value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PlaceDetailResponse() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PlaceDetailResponse value)  $default,){
final _that = this;
switch (_that) {
case _PlaceDetailResponse():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PlaceDetailResponse value)?  $default,){
final _that = this;
switch (_that) {
case _PlaceDetailResponse() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int id,  String name,  String category,  String? description,  double lat,  double lng, @JsonKey(name: 'thumb_url')  String? thumbUrl, @JsonKey(name: 'saves_count')  int savesCount,  String? status,  PlaceAuthor? user,  List<PlacePhotoItem> photos, @JsonKey(name: 'saved_by_me')  bool? savedByMe, @JsonKey(name: 'created_at')  String? createdAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PlaceDetailResponse() when $default != null:
return $default(_that.id,_that.name,_that.category,_that.description,_that.lat,_that.lng,_that.thumbUrl,_that.savesCount,_that.status,_that.user,_that.photos,_that.savedByMe,_that.createdAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int id,  String name,  String category,  String? description,  double lat,  double lng, @JsonKey(name: 'thumb_url')  String? thumbUrl, @JsonKey(name: 'saves_count')  int savesCount,  String? status,  PlaceAuthor? user,  List<PlacePhotoItem> photos, @JsonKey(name: 'saved_by_me')  bool? savedByMe, @JsonKey(name: 'created_at')  String? createdAt)  $default,) {final _that = this;
switch (_that) {
case _PlaceDetailResponse():
return $default(_that.id,_that.name,_that.category,_that.description,_that.lat,_that.lng,_that.thumbUrl,_that.savesCount,_that.status,_that.user,_that.photos,_that.savedByMe,_that.createdAt);}
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int id,  String name,  String category,  String? description,  double lat,  double lng, @JsonKey(name: 'thumb_url')  String? thumbUrl, @JsonKey(name: 'saves_count')  int savesCount,  String? status,  PlaceAuthor? user,  List<PlacePhotoItem> photos, @JsonKey(name: 'saved_by_me')  bool? savedByMe, @JsonKey(name: 'created_at')  String? createdAt)?  $default,) {final _that = this;
switch (_that) {
case _PlaceDetailResponse() when $default != null:
return $default(_that.id,_that.name,_that.category,_that.description,_that.lat,_that.lng,_that.thumbUrl,_that.savesCount,_that.status,_that.user,_that.photos,_that.savedByMe,_that.createdAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PlaceDetailResponse implements PlaceDetailResponse {
  const _PlaceDetailResponse({required this.id, required this.name, required this.category, this.description, required this.lat, required this.lng, @JsonKey(name: 'thumb_url') this.thumbUrl, @JsonKey(name: 'saves_count') this.savesCount = 0, this.status, this.user, final  List<PlacePhotoItem> photos = const [], @JsonKey(name: 'saved_by_me') this.savedByMe, @JsonKey(name: 'created_at') this.createdAt}): _photos = photos;
  factory _PlaceDetailResponse.fromJson(Map<String, dynamic> json) => _$PlaceDetailResponseFromJson(json);

@override final  int id;
@override final  String name;
@override final  String category;
@override final  String? description;
@override final  double lat;
@override final  double lng;
@override@JsonKey(name: 'thumb_url') final  String? thumbUrl;
@override@JsonKey(name: 'saves_count') final  int savesCount;
@override final  String? status;
@override final  PlaceAuthor? user;
 final  List<PlacePhotoItem> _photos;
@override@JsonKey() List<PlacePhotoItem> get photos {
  if (_photos is EqualUnmodifiableListView) return _photos;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_photos);
}

@override@JsonKey(name: 'saved_by_me') final  bool? savedByMe;
@override@JsonKey(name: 'created_at') final  String? createdAt;

/// Create a copy of PlaceDetailResponse
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PlaceDetailResponseCopyWith<_PlaceDetailResponse> get copyWith => __$PlaceDetailResponseCopyWithImpl<_PlaceDetailResponse>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PlaceDetailResponseToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PlaceDetailResponse&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.category, category) || other.category == category)&&(identical(other.description, description) || other.description == description)&&(identical(other.lat, lat) || other.lat == lat)&&(identical(other.lng, lng) || other.lng == lng)&&(identical(other.thumbUrl, thumbUrl) || other.thumbUrl == thumbUrl)&&(identical(other.savesCount, savesCount) || other.savesCount == savesCount)&&(identical(other.status, status) || other.status == status)&&(identical(other.user, user) || other.user == user)&&const DeepCollectionEquality().equals(other._photos, _photos)&&(identical(other.savedByMe, savedByMe) || other.savedByMe == savedByMe)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,category,description,lat,lng,thumbUrl,savesCount,status,user,const DeepCollectionEquality().hash(_photos),savedByMe,createdAt);

@override
String toString() {
  return 'PlaceDetailResponse(id: $id, name: $name, category: $category, description: $description, lat: $lat, lng: $lng, thumbUrl: $thumbUrl, savesCount: $savesCount, status: $status, user: $user, photos: $photos, savedByMe: $savedByMe, createdAt: $createdAt)';
}


}

/// @nodoc
abstract mixin class _$PlaceDetailResponseCopyWith<$Res> implements $PlaceDetailResponseCopyWith<$Res> {
  factory _$PlaceDetailResponseCopyWith(_PlaceDetailResponse value, $Res Function(_PlaceDetailResponse) _then) = __$PlaceDetailResponseCopyWithImpl;
@override @useResult
$Res call({
 int id, String name, String category, String? description, double lat, double lng,@JsonKey(name: 'thumb_url') String? thumbUrl,@JsonKey(name: 'saves_count') int savesCount, String? status, PlaceAuthor? user, List<PlacePhotoItem> photos,@JsonKey(name: 'saved_by_me') bool? savedByMe,@JsonKey(name: 'created_at') String? createdAt
});




}
/// @nodoc
class __$PlaceDetailResponseCopyWithImpl<$Res>
    implements _$PlaceDetailResponseCopyWith<$Res> {
  __$PlaceDetailResponseCopyWithImpl(this._self, this._then);

  final _PlaceDetailResponse _self;
  final $Res Function(_PlaceDetailResponse) _then;

/// Create a copy of PlaceDetailResponse
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? name = null,Object? category = null,Object? description = freezed,Object? lat = null,Object? lng = null,Object? thumbUrl = freezed,Object? savesCount = null,Object? status = freezed,Object? user = freezed,Object? photos = null,Object? savedByMe = freezed,Object? createdAt = freezed,}) {
  return _then(_PlaceDetailResponse(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,category: null == category ? _self.category : category // ignore: cast_nullable_to_non_nullable
as String,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,lat: null == lat ? _self.lat : lat // ignore: cast_nullable_to_non_nullable
as double,lng: null == lng ? _self.lng : lng // ignore: cast_nullable_to_non_nullable
as double,thumbUrl: freezed == thumbUrl ? _self.thumbUrl : thumbUrl // ignore: cast_nullable_to_non_nullable
as String?,savesCount: null == savesCount ? _self.savesCount : savesCount // ignore: cast_nullable_to_non_nullable
as int,status: freezed == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String?,user: freezed == user ? _self.user : user // ignore: cast_nullable_to_non_nullable
as PlaceAuthor?,photos: null == photos ? _self._photos : photos // ignore: cast_nullable_to_non_nullable
as List<PlacePhotoItem>,savedByMe: freezed == savedByMe ? _self.savedByMe : savedByMe // ignore: cast_nullable_to_non_nullable
as bool?,createdAt: freezed == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}

// dart format on
