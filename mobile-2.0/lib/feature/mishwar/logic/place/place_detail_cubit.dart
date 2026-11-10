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

  Future<bool> toggleSave() async {
    final place = state.maybeWhen(
      success: (p) => p,
      orElse: () => null,
    );
    if (place == null) return false;

    final currentlySaved = place.savedByMe ?? false;
    final newSaved = !currentlySaved;
    final newCount = newSaved ? place.savesCount + 1 : (place.savesCount > 0 ? place.savesCount - 1 : 0);

    // Optimistic update
    safeEmit(PlaceDetailState.success(place.copyWith(
      savedByMe: newSaved,
      savesCount: newCount,
    )));

    final result = newSaved
        ? await _repo.savePlace(place.id)
        : await _repo.unsavePlace(place.id);

    return result.when(
      success: (resp) {
        safeEmit(PlaceDetailState.success(place.copyWith(
          savedByMe: resp.saved,
          savesCount: resp.savesCount,
        )));
        return true;
      },
      error: (_) {
        safeEmit(PlaceDetailState.success(place));
        return false;
      },
    );
  }
}
