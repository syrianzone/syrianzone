import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:syrianzone/core/network/response/user_response.dart';

part 'auth_state.freezed.dart';

@freezed
class AuthState with _$AuthState {
  const factory AuthState.initial() = _Initial;
  const factory AuthState.loading() = _Loading;
  const factory AuthState.authenticated(UserResponse user) = _Authenticated;
  const factory AuthState.unauthenticated({String? message}) = _Unauthenticated;
  const factory AuthState.error(String message) = _Error;
}
