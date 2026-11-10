import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:syrianzone/core/network/response/place_detail_response.dart';

part 'place_detail_state.freezed.dart';

@freezed
class PlaceDetailState with _$PlaceDetailState {
  const factory PlaceDetailState.initial() = _Initial;
  const factory PlaceDetailState.loading() = Loading;
  const factory PlaceDetailState.success(PlaceDetailResponse place) = Success;
  const factory PlaceDetailState.error(String message) = Error;
}
