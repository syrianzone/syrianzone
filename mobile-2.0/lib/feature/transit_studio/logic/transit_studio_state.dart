import 'dart:ui';
import 'package:flutter_osm_plugin/flutter_osm_plugin.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:syrianzone/core/constants/route_palette.dart';
import 'package:syrianzone/core/network/response/city_response.dart';
import 'package:syrianzone/core/network/response/map_data_response.dart';
import 'package:syrianzone/core/util/color_util.dart';
import 'package:syrianzone/feature/transit_studio/data/model/studio_stop.dart';
import 'package:syrianzone/feature/transit_studio/data/model/studio_tool_mode.dart';

part 'transit_studio_state.freezed.dart';

@freezed
abstract class TransitStudioState with _$TransitStudioState {
  const TransitStudioState._();

  const factory TransitStudioState({
    @Default(false) bool isLoadingCities,
    @Default([]) List<CityResponse> cities,
    String? citiesError,
    CityResponse? selectedCity,
    @Default(false) bool isLoadingMapData,
    
    MapDataResponse? cityMapData,
    String? mapDataError,
    @Default(StudioToolMode.none) StudioToolMode activeTool,
    @Default([]) List<GeoPoint> roadPoints,
    int? selectedPointIndex,
    @Default([]) List<StudioStop> stops,
    @Default(0) int selectedColorIndex,
    @Default(false) bool isSubmitting,
    @Default(false) bool submitSuccess,
    String? errorMessage,
    String? successMessage,
    int? expandSectionIndex,
  }) = _TransitStudioState;

  factory TransitStudioState.initial() => const TransitStudioState();

  Color get currentColor => ColorUtil.hexToColor(
        RoutePalette.colorForIndexOrDefault(selectedColorIndex),
      );
}
