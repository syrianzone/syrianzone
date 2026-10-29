import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:syrianzone/core/bloc/safe_emit_mixin.dart';
import 'package:syrianzone/core/network/api_result.dart';
import 'package:syrianzone/feature/transit/repo/transit_repo.dart';
import 'transit_submissions_state.dart';

class TransitSubmissionsCubit extends Cubit<TransitSubmissionsState>
    with SafeEmit<TransitSubmissionsState> {
  final TransitRepo _transitRepo;

  TransitSubmissionsCubit(this._transitRepo)
      : super(TransitSubmissionsState.initial());

  Future<void> loadSubmissions() async {
    safeEmit(state.copyWith(isLoading: true, errorMessage: null));
    final result = await _transitRepo.getUserSubmissions();
    result.when(
      success: (response) {
        safeEmit(state.copyWith(
          isLoading: false,
          submissions: response.data,
          errorMessage: null,
        ));
      },
      error: (error) {
        safeEmit(state.copyWith(
          isLoading: false,
          errorMessage: error,
        ));
      },
    );
  }

  Future<bool> withdrawOrDelete(int id) async {
    safeEmit(state.copyWith(
      deletingIds: {...state.deletingIds, id},
      actionError: null,
    ));

    final result = await _transitRepo.deleteRoute(id);
    return result.when(
      success: (_) {
        final updated =
            state.submissions.where((item) => item.id != id).toList();
        final updatedDeleting = Set<int>.from(state.deletingIds)..remove(id);
        safeEmit(state.copyWith(
          submissions: updated,
          deletingIds: updatedDeleting,
          actionError: null,
        ));
        return true;
      },
      error: (error) {
        final updatedDeleting = Set<int>.from(state.deletingIds)..remove(id);
        safeEmit(state.copyWith(
          deletingIds: updatedDeleting,
          actionError: error,
        ));
        return false;
      },
    );
  }

  void clearActionError() {
    if (state.actionError != null) {
      safeEmit(state.copyWith(actionError: null));
    }
  }
}
