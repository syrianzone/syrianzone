import 'package:json_annotation/json_annotation.dart';

part 'api_error_response.g.dart';

@JsonSerializable()
class ApiErrorResponse {
  final String message;

  /*
  TODO: do we need additional fields from the API error response such as:
  "errors": {
    "lat": ["The lat field is required."],
    "lng": ["The lng field is required."]
  } 
  */

  ApiErrorResponse({required this.message});

  factory ApiErrorResponse.fromJson(Map<String, dynamic> json) =>
      _$ApiErrorResponseFromJson(json);
}
