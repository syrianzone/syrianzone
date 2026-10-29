import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:syrianzone/core/network/response/user_response.dart';

class TokenStorage {
  static const String _tokenKey = 'sz_bearer_token';
  static const String _userKey = 'sz_cached_user';

  final FlutterSecureStorage _secureStorage;
  final SharedPreferences _preferences;

  TokenStorage({
    FlutterSecureStorage? secureStorage,
    required SharedPreferences preferences,
  })  : _secureStorage = secureStorage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(resetOnError: true),
              iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
            ),
        _preferences = preferences;

  Future<void> saveToken(String token) async {
    await _secureStorage.write(key: _tokenKey, value: token);
  }

  Future<String?> getToken() async {
    return await _secureStorage.read(key: _tokenKey);
  }

  Future<bool> hasToken() async {
    final token = await getToken();
    return token != null && token.isNotEmpty;
  }

  Future<void> saveUser(UserResponse user) async {
    await _preferences.setString(_userKey, jsonEncode(user.toJson()));
  }

  UserResponse? getUser() {
    final userJson = _preferences.getString(_userKey);
    if (userJson == null || userJson.isEmpty) {
      return null;
    }
    try {
      final decoded = jsonDecode(userJson) as Map<String, dynamic>;
      return UserResponse.fromJson(decoded);
    } catch (_) {
      return null;
    }
  }

  Future<void> clear() async {
    await _secureStorage.delete(key: _tokenKey);
    await _preferences.remove(_userKey);
  }
}
