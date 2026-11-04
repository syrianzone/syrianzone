import 'package:flutter/material.dart';
import 'package:syrianzone/feature/auth/logic/auth_cubit.dart';
import 'package:syrianzone/feature/auth/ui/auth_bottom_sheet.dart';

class AuthGuard {
  final AuthCubit _authCubit;

  const AuthGuard(this._authCubit);

  /// Ensures the user is logged in before running [onAuthorized].
  /// If not logged in, opens the Google login bottom sheet.
  /// If the user completes login, [onAuthorized] is executed.
  Future<void> run(
    BuildContext context, {
    required VoidCallback onAuthorized,
  }) async {
    if (_authCubit.isAuthenticated) {
      onAuthorized();
      return;
    }

    final success = await AuthBottomSheet.show(context);
    if (success && context.mounted) {
      onAuthorized();
    }
  }
}
