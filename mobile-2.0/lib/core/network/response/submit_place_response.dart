import 'package:json_annotation/json_annotation.dart';

part 'submit_place_response.g.dart';

@JsonSerializable()
class SubmitPlaceResponse {
  final int id;
  final String status;

  SubmitPlaceResponse({
    required this.id,
    required this.status,
  });

  factory SubmitPlaceResponse.fromJson(Map<String, dynamic> json) =>
      _$SubmitPlaceResponseFromJson(json);

  Map<String, dynamic> toJson() => _$SubmitPlaceResponseToJson(this);
}
