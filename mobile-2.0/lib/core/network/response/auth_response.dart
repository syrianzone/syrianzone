import 'package:json_annotation/json_annotation.dart';
import 'package:syrianzone/core/network/response/user_response.dart';

part 'auth_response.g.dart';

@JsonSerializable()
class AuthResponse {
  final String token;
  @JsonKey(name: 'token_type')
  final String? tokenType;
  @JsonKey(name: 'expires_at')
  final String? expiresAt;
  final UserResponse user;

  const AuthResponse({
    required this.token,
    this.tokenType,
    this.expiresAt,
    required this.user,
  });

  factory AuthResponse.fromJson(Map<String, dynamic> json) =>
      _$AuthResponseFromJson(json);

  Map<String, dynamic> toJson() => _$AuthResponseToJson(this);
}
