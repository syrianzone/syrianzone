import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:syrianzone/core/network/response/user_submissions_response.dart';

part 'transit_submissions_state.freezed.dart';

@freezed
abstract class TransitSubmissionsState with _$TransitSubmissionsState {
  const TransitSubmissionsState._();

  const factory TransitSubmissionsState({
    @Default(false) bool isLoading,
    @Default([]) List<RouteDraftItem> submissions,
    String? errorMessage,
    @Default({}) Set<int> deletingIds,
    String? actionError,
  }) = _TransitSubmissionsState;

  factory TransitSubmissionsState.initial() =>
      const TransitSubmissionsState(isLoading: true);
}
