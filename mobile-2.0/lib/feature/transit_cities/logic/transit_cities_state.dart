import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:syrianzone/core/network/response/city_response.dart';

part 'transit_cities_state.freezed.dart';

@freezed
class TransitCitiesState with _$TransitCitiesState {
  const factory TransitCitiesState.initial() = _Initial;
  const factory TransitCitiesState.loading() = Loading;
  const factory TransitCitiesState.error(String message) = Error;
  const factory TransitCitiesState.success(List<CityResponse> cities) = Success;
}