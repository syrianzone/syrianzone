import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:syrianzone/core/bloc/safe_emit_mixin.dart';
import 'package:syrianzone/core/network/response/guides_response.dart';
import 'package:syrianzone/feature/mishwar/logic/guide/guide_detail_state.dart';

class GuideDetailCubit extends Cubit<GuideDetailState> with SafeEmit<GuideDetailState> {
  GuideDetailCubit({
    GuideDetailState initialState = const GuideDetailState.initial(),
  }) : super(initialState);

  Future<void> loadGuide(GuideItemResponse guide) async {
    safeEmit(const GuideDetailState.loading());
    await Future.delayed(const Duration(milliseconds: 300));
    safeEmit(GuideDetailState.success(guide));
  }
}
