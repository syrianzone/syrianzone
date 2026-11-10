import 'package:json_annotation/json_annotation.dart';

part 'save_place_response.g.dart';

@JsonSerializable()
class SavePlaceResponse {
  final bool saved;
  @JsonKey(name: 'saves_count')
  final int savesCount;

  SavePlaceResponse({
    required this.saved,
    required this.savesCount,
  });

  factory SavePlaceResponse.fromJson(Map<String, dynamic> json) =>
      _$SavePlaceResponseFromJson(json);

  Map<String, dynamic> toJson() => _$SavePlaceResponseToJson(this);
}
