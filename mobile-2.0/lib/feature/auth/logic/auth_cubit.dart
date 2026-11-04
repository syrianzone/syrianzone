import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:syrianzone/core/bloc/safe_emit_mixin.dart';
import 'package:syrianzone/core/network/api_result.dart';
import 'package:syrianzone/core/network/auth_interceptor.dart';
import 'package:syrianzone/core/network/response/user_response.dart';
import 'package:syrianzone/feature/auth/logic/auth_state.dart';
import 'package:syrianzone/feature/auth/repo/auth_repo.dart';

class AuthCubit extends Cubit<AuthState> with SafeEmit<AuthState> {
  final AuthRepo _authRepo;
  StreamSubscription<void>? _unauthorizedSub;

  AuthCubit(this._authRepo) : super(const AuthState.initial()) {
    _unauthorizedSub =
        AuthInterceptor.onUnauthorizedStream.stream.listen((_) {
      logout();
    });
    checkAuthStatus();
  }

  bool get isAuthenticated => state.maybeWhen(
        authenticated: (_) => true,
        orElse: () => false,
      );

  UserResponse? get currentUser => state.maybeWhen(
        authenticated: (user) => user,
        orElse: () => _authRepo.getCachedUser(),
      );

  Future<void> checkAuthStatus() async {
    final cached = _authRepo.getCachedUser();
    if (cached != null) {
      safeEmit(AuthState.authenticated(cached));
    }

    final result = await _authRepo.checkAuthStatus();
    result.when(
      success: (user) {
        safeEmit(AuthState.authenticated(user));
      },
      error: (error) {
        if (cached == null) {
          safeEmit(const AuthState.unauthenticated());
        }
      },
    );
  }

  Future<bool> loginWithGoogle() async {
    safeEmit(const AuthState.loading());
    final result = await _authRepo.signInWithGoogle();

    return result.when(
      success: (user) {
        safeEmit(AuthState.authenticated(user));
        return true;
      },
      error: (message) {
        safeEmit(AuthState.error(message));
        return false;
      },
    );
  }

  Future<void> logout() async {
    safeEmit(const AuthState.loading());
    await _authRepo.logout();
    safeEmit(const AuthState.unauthenticated(message: 'تم تسجيل الخروج بنجاح'));
  }

  @override
  Future<void> close() {
    _unauthorizedSub?.cancel();
    return super.close();
  }
}
