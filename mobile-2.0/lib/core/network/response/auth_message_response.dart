import 'package:json_annotation/json_annotation.dart';

part 'auth_message_response.g.dart';

@JsonSerializable()
class AuthMessageResponse {
  final bool? ok;
  final String? message;

  const AuthMessageResponse({
    this.ok,
    this.message,
  });

  factory AuthMessageResponse.fromJson(Map<String, dynamic> json) =>
      _$AuthMessageResponseFromJson(json);

  Map<String, dynamic> toJson() => _$AuthMessageResponseToJson(this);
}
