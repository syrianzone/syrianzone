
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:syrianzone/core/network/response/map_data_response.dart';
import 'package:syrianzone/core/network/response/transit_search_response.dart';
import 'package:syrianzone/core/network/response/nearby_stop_response.dart';

part 'transit_state.freezed.dart';


@freezed
sealed class TransitState with _$TransitState {
  factory TransitState({
    @Default(false) bool isLoading,
    MapDataResponse? mapData,
    String? routesErrorMessage,
    String? searchErrorMessage,
    TransitSearchResponse? searchResults,
    @Default(false) bool searchLoading,
    @Default(false) bool nearbyLoading,
    List<NearbyStopResponse>? nearbyStops,
    String? nearbyErrorMessage,
  }) = _TransitState;
}