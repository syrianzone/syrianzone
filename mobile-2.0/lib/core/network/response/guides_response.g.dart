// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'guides_response.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

GuidesResponse _$GuidesResponseFromJson(Map<String, dynamic> json) =>
    GuidesResponse(
      sort: json['sort'] as String,
      guides: (json['guides'] as List<dynamic>)
          .map((e) => GuideItemResponse.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$GuidesResponseToJson(GuidesResponse instance) =>
    <String, dynamic>{'sort': instance.sort, 'guides': instance.guides};

GuideItemResponse _$GuideItemResponseFromJson(Map<String, dynamic> json) =>
    GuideItemResponse(
      rank: (json['rank'] as num).toInt(),
      userId: (json['user_id'] as num).toInt(),
      name: json['name'] as String,
      avatarUrl: json['avatar_url'] as String?,
      approvedCount: (json['approved_count'] as num?)?.toInt() ?? 0,
      savesTotal: (json['saves_total'] as num?)?.toInt() ?? 0,
      recentCount: (json['recent_count'] as num?)?.toInt() ?? 0,
      points: (json['points'] as num?)?.toInt() ?? 0,
      level: (json['level'] as num?)?.toInt() ?? 1,
    );

Map<String, dynamic> _$GuideItemResponseToJson(GuideItemResponse instance) =>
    <String, dynamic>{
      'rank': instance.rank,
      'user_id': instance.userId,
      'name': instance.name,
      'avatar_url': instance.avatarUrl,
      'approved_count': instance.approvedCount,
      'saves_total': instance.savesTotal,
      'recent_count': instance.recentCount,
      'points': instance.points,
      'level': instance.level,
    };
