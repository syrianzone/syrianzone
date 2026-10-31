import 'package:bloc/bloc.dart';

/// Guards state emissions against a cubit that was already closed.
///
/// `emit` throws `Bad state: Cannot emit new states after calling close`, which
/// happens whenever an in-flight request resolves after the `BlocProvider` that
/// created the cubit was disposed (the user navigated back). Route every
/// emission that follows an `await` through [safeEmit]:
///
/// ```dart
/// class TransitCubit extends Cubit<TransitState> with SafeEmit<TransitState> {
///   Future<void> fetch() async {
///     safeEmit(const TransitState.loading());
///     final result = await _repo.fetch();
///     ...
///   }
/// }
/// ```
///
/// A mixin is required (rather than an extension) because `BlocBase.emit` is
/// `@protected`, so it can only be reached from a subclass.
mixin SafeEmit<State> on Cubit<State> {
  /// Emits [state] unless this cubit has already been closed.
  void safeEmit(State state) {
    if (isClosed) return;
    emit(state);
  }
}
