import 'package:json_annotation/json_annotation.dart';

part 'google_token_request.g.dart';

@JsonSerializable()
class GoogleTokenRequest {
  @JsonKey(name: 'id_token')
  final String? idToken;
  @JsonKey(name: 'access_token')
  final String? accessToken;
  @JsonKey(name: 'device_name')
  final String? deviceName;

  const GoogleTokenRequest({
    this.idToken,
    this.accessToken,
    this.deviceName,
  });

  factory GoogleTokenRequest.fromJson(Map<String, dynamic> json) =>
      _$GoogleTokenRequestFromJson(json);

  Map<String, dynamic> toJson() => _$GoogleTokenRequestToJson(this);
}
