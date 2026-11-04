import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:syrianzone/core/network/response/guides_response.dart';

part 'guide_detail_state.freezed.dart';

@freezed
class GuideDetailState with _$GuideDetailState {
  const factory GuideDetailState.initial() = _Initial;
  const factory GuideDetailState.loading() = Loading;
  const factory GuideDetailState.success(GuideItemResponse guide) = Success;
  const factory GuideDetailState.error(String message) = Error;
}
