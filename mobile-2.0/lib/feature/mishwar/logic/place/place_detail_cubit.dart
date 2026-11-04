import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:syrianzone/core/bloc/safe_emit_mixin.dart';
import 'package:syrianzone/core/network/api_result.dart';
import 'package:syrianzone/feature/mishwar/logic/place/place_detail_state.dart';
import 'package:syrianzone/feature/mishwar/repo/mishwar_repo.dart';

class PlaceDetailCubit extends Cubit<PlaceDetailState> with SafeEmit<PlaceDetailState> {
  final MishwarRepo _repo;

  PlaceDetailCubit(
    this._repo, {
    PlaceDetailState initialState = const PlaceDetailState.initial(),
  }) : super(initialState);

  Future<void> loadPlaceDetail(int id) async {
    safeEmit(const PlaceDetailState.loading());
    final result = await _repo.getPlaceDetail(id);
    result.when(
      success: (place) => safeEmit(PlaceDetailState.success(place)),
      error: (error) => safeEmit(PlaceDetailState.error(error)),
    );
  }
}
