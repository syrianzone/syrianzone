import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:syrianzone/core/bloc/safe_emit_mixin.dart';
import 'package:syrianzone/core/network/api_result.dart';
import 'package:syrianzone/feature/mishwar/logic/hotel/hotel_detail_state.dart';
import 'package:syrianzone/feature/mishwar/repo/mishwar_repo.dart';

class HotelDetailCubit extends Cubit<HotelDetailState> with SafeEmit<HotelDetailState> {
  final MishwarRepo _repo;

  HotelDetailCubit(
    this._repo, {
    HotelDetailState initialState = const HotelDetailState.initial(),
  }) : super(initialState);

  Future<void> loadHotelDetail(int id) async {
    safeEmit(const HotelDetailState.loading());
    final result = await _repo.getHotelDetail(id);
    result.when(
      success: (hotel) => safeEmit(HotelDetailState.success(hotel)),
      error: (error) => safeEmit(HotelDetailState.error(error)),
    );
  }
}
