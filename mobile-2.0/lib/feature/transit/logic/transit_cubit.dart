import 'package:bloc/bloc.dart';
import 'package:syrianzone/core/network/api_result.dart';
import 'package:syrianzone/core/bloc/safe_emit_mixin.dart';
import 'transit_state.dart';
import '../repo/transit_repo.dart';

class TransitCubit extends Cubit<TransitState> with SafeEmit<TransitState> {
  final TransitRepo _transitRepo;
  TransitCubit(this._transitRepo) : super(TransitState());


  void clearSearch() {
    safeEmit(state.copyWith(
      searchResults: null,
      searchLoading: false,
      searchErrorMessage: null,
    ));
  }

  void searchTransit(String query, String cityId) async {
    safeEmit(state.copyWith(searchLoading: true, searchErrorMessage: null));

    final result = await _transitRepo.searchTransit(query, cityId);

    result.when(
      success: (searchResults) => safeEmit(state.copyWith(searchResults: searchResults, searchLoading: false, searchErrorMessage: null)),
      error: (message) => safeEmit(state.copyWith(searchLoading: false, searchErrorMessage: message)),
    );
  }

  Future<void> fetchMapData(String cityId) async {
    safeEmit(state.copyWith(isLoading: true,routesErrorMessage: null));

    final result = await _transitRepo.fetchMapData(cityId.toString());

    result.when(
      success: (mapData) => safeEmit(state.copyWith(mapData: mapData, isLoading: false, routesErrorMessage: null)),
      error: (message) => safeEmit(state.copyWith(isLoading: false, routesErrorMessage: message)),
    );
  }

  Future<void> getNearbyStops(double latitude, double longitude) async {
    safeEmit(state.copyWith(
      nearbyLoading: true,
      nearbyErrorMessage: null,
    ));

    final result = await _transitRepo.getNearbyStops(latitude, longitude);

    result.when(
      success: (nearbyStops) => safeEmit(state.copyWith(
        nearbyStops: nearbyStops,
        nearbyLoading: false,
        nearbyErrorMessage: null,
      )),
      error: (message) => safeEmit(state.copyWith(
        nearbyLoading: false,
        nearbyErrorMessage: message,
      )),
    );
  }

  void clearNearbyStops() {
    safeEmit(state.copyWith(
      nearbyStops: null,
      nearbyLoading: false,
      nearbyErrorMessage: null,
    ));
  }
}
