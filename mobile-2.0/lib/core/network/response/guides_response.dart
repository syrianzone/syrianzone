import 'package:json_annotation/json_annotation.dart';

part 'guides_response.g.dart';

@JsonSerializable()
class GuidesResponse {
  final String sort;
  final List<GuideItemResponse> guides;

  GuidesResponse({
    required this.sort,
    required this.guides,
  });

  factory GuidesResponse.fromJson(Map<String, dynamic> json) =>
      _$GuidesResponseFromJson(json);
}

@JsonSerializable()
class GuideItemResponse {
  final int rank;
  @JsonKey(name: 'user_id')
  final int userId;
  final String name;
  @JsonKey(name: 'avatar_url')
  final String? avatarUrl;
  @JsonKey(name: 'approved_count')
  final int approvedCount;
  @JsonKey(name: 'saves_total')
  final int savesTotal;
  @JsonKey(name: 'recent_count')
  final int recentCount;
  final int points;
  final int level;

  GuideItemResponse({
    required this.rank,
    required this.userId,
    required this.name,
    this.avatarUrl,
    this.approvedCount = 0,
    this.savesTotal = 0,
    this.recentCount = 0,
    this.points = 0,
    this.level = 1,
  });

  factory GuideItemResponse.fromJson(Map<String, dynamic> json) =>
      _$GuideItemResponseFromJson(json);
}
