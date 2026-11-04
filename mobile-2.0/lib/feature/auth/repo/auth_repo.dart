import 'dart:io';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:syrianzone/core/constants/api_service_constants.dart';
import 'package:syrianzone/core/network/api_result.dart';
import 'package:syrianzone/core/network/api_service.dart';
import 'package:syrianzone/core/network/response/user_response.dart';
import 'package:syrianzone/core/storage/token_storage.dart';
import 'package:syrianzone/feature/auth/data/models/google_token_request.dart';

class AuthRepo {
  final ApiService _apiService;
  final TokenStorage _tokenStorage;
  final GoogleSignIn _googleSignIn;

  AuthRepo(
    this._apiService,
    this._tokenStorage, {
    GoogleSignIn? googleSignIn,
  }) : _googleSignIn = googleSignIn ??
            GoogleSignIn(
              serverClientId: ApiServiceConstants.googleWebClientId,
              scopes: const ['email', 'profile'],
            );

  
  UserResponse? getCachedUser() => _tokenStorage.getUser();

  Future<bool> hasToken() => _tokenStorage.hasToken();

  Future<ApiResult<UserResponse>> signInWithGoogle() async {
    try {
      // 1. Launch native Google Sign-In prompt
      final GoogleSignInAccount? account = await _googleSignIn.signIn();
      if (account == null) {
        return ApiResult.error('تم إلغاء تسجيل الدخول');
      }

      // 2. Obtain OAuth tokens
      final GoogleSignInAuthentication auth = await account.authentication;
      final String? idToken = auth.idToken;
      final String? accessToken = auth.accessToken;

      if ((idToken == null || idToken.isEmpty) &&
          (accessToken == null || accessToken.isEmpty)) {
        return ApiResult.error('Invalid Token');
      }

      // Device name for audit trail
      final deviceName = 'Flutter (${Platform.isAndroid ? 'Android' : Platform.isIOS ? 'iOS' : 'Mobile'})';

      // 3. Exchange with Syrian Zone backend
      final response = await _apiService.exchangeGoogleToken(
        GoogleTokenRequest(
          idToken: idToken,
          accessToken: accessToken,
          deviceName: deviceName,
        ),
      );
      
      
      // 4. Persist Sanctum bearer token and user
      await _tokenStorage.saveToken(response.token);
      await _tokenStorage.saveUser(response.user);

      return ApiResult.success(response.user);
    } catch (e) {
      return ApiResult.error('فشل تسجيل الدخول: ${e.toString()}');
    }
  }

  Future<ApiResult<UserResponse>> checkAuthStatus() async {
    final hasToken = await _tokenStorage.hasToken();
    if (!hasToken) {
      return ApiResult.error('غير مسجل');
    }

    // Try fetching fresh user from backend
    try {
      final user = await _apiService.getAuthUser();
      await _tokenStorage.saveUser(user);
      return ApiResult.success(user);
    } catch (_) {
      // If network fails but local user exists, fallback to cached
      final cached = _tokenStorage.getUser();
      if (cached != null) {
        return ApiResult.success(cached);
      }
      return ApiResult.error('انتهت صلاحية الجلسة');
    }
  }

  Future<void> logout() async {
    try {
      await _apiService.logout();
    } catch (_) {
      // Network failures during logout shouldn't prevent local cleanup
    }

    try {
      await _googleSignIn.signOut();
    } catch (_) {}

    await _tokenStorage.clear();
  }
}
