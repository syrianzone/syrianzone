import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:syrianzone/core/network/response/hotel_detail_response.dart';

part 'hotel_detail_state.freezed.dart';

@freezed
class HotelDetailState with _$HotelDetailState {
  const factory HotelDetailState.initial() = _Initial;
  const factory HotelDetailState.loading() = Loading;
  const factory HotelDetailState.success(HotelDetailResponse hotel) = Success;
  const factory HotelDetailState.error(String message) = Error;
}
