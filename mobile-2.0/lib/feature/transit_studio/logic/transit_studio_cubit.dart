import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_osm_plugin/flutter_osm_plugin.dart';
import 'package:syrianzone/core/bloc/safe_emit_mixin.dart';
import 'package:syrianzone/core/extensions/api_error_handler.dart';
import 'package:syrianzone/core/network/api_result.dart';
import 'package:syrianzone/core/network/request/new_transit_route_request_body.dart';
import 'package:syrianzone/core/network/response/city_response.dart';
import 'package:syrianzone/core/network/response/map_data_response.dart';
import 'package:syrianzone/feature/transit/repo/transit_repo.dart';
import 'package:syrianzone/feature/transit_studio/data/model/studio_stop.dart';
import 'package:syrianzone/feature/transit_studio/data/model/studio_tool_mode.dart';
import 'transit_studio_state.dart';

class TransitStudioCubit extends Cubit<TransitStudioState>
    with SafeEmit<TransitStudioState> {
  final TransitRepo _transitRepo;
  final Map<String, MapDataResponse> _mapDataCache = {};
  Map<String, MapDataResponse> get mapDataCache =>
      Map.unmodifiable(_mapDataCache);

  // Text controllers owned by Cubit
  final TextEditingController nameArController = TextEditingController();
  final TextEditingController nameEnController = TextEditingController();
  final TextEditingController priceController = TextEditingController();
  final TextEditingController notesController = TextEditingController();

  TransitStudioCubit(this._transitRepo) : super(TransitStudioState.initial());

  Future<void> loadCities() async {
    safeEmit(state.copyWith(
      isLoadingCities: true,
      citiesError: null,
      errorMessage: null,
    ));

    final citiesResult = await _transitRepo.getTransitCities();

    citiesResult.when(
      success: (cities) {
        if (cities.isNotEmpty) {
          final initialCity = cities.first;
          safeEmit(state.copyWith(
            isLoadingCities: false,
            cities: cities,
            citiesError: null,
          ));
          selectCity(initialCity);
        } else {
          safeEmit(state.copyWith(
            isLoadingCities: false,
            cities: const [],
            citiesError: null,
          ));
        }
      },
      error: (error) {
        safeEmit(state.copyWith(
          isLoadingCities: false,
          citiesError: error,
          errorMessage: error,
        ));
      },
    );
  }

  Future<void> selectCity(CityResponse city) async {
    if (state.isSubmitting) return;

    // If already selected and mapData is loaded, do nothing
    if (state.selectedCity?.id == city.id && state.cityMapData != null) {
      return;
    }

    // Check in-memory cache
    if (_mapDataCache.containsKey(city.id)) {
      safeEmit(
        state.copyWith(
          selectedCity: city,
          cityMapData: _mapDataCache[city.id],
          isLoadingMapData: false,
          mapDataError: null,
        ),
      );
      return;
    }

    // Not cached: emit loading state
    safeEmit(
      state.copyWith(
        selectedCity: city,
        cityMapData: null,
        isLoadingMapData: true,
        mapDataError: null,
      ),
    );

    final result = await _transitRepo.fetchMapData(city.id);

    // Guard if user switched to another city in the meantime
    if (state.selectedCity?.id != city.id) {
      result.whenOrNull(success: (data) => _mapDataCache[city.id] = data);
      return;
    }

    result.when(
      success: (data) {
        _mapDataCache[city.id] = data;
        safeEmit(
          state.copyWith(
            cityMapData: data,
            isLoadingMapData: false,
            mapDataError: null,
          ),
        );
      },
      error: (error) {
        safeEmit(state.copyWith(isLoadingMapData: false, mapDataError: error));
      },
    );
  }

  void setToolMode(StudioToolMode mode) {
    if (state.isSubmitting) return;
    safeEmit(
      state.copyWith(
        activeTool: mode,
        selectedPointIndex: mode == StudioToolMode.movePoint
            ? state.selectedPointIndex
            : null,
      ),
    );
  }

  void addRoadPoint(GeoPoint point) {
    if (state.isSubmitting) return;
    final updated = List<GeoPoint>.from(state.roadPoints)..add(point);
    safeEmit(state.copyWith(roadPoints: updated));
  }

  void selectPointToMove(int index) {
    if (state.isSubmitting) return;
    if (index < 0 || index >= state.roadPoints.length) return;
    safeEmit(
      state.copyWith(
        selectedPointIndex: index,
        activeTool: StudioToolMode.movePoint,
      ),
    );
  }

  void cancelMovePoint() {
    if (state.isSubmitting) return;
    safeEmit(
      state.copyWith(
        selectedPointIndex: null,
        activeTool: StudioToolMode.drawRoad,
      ),
    );
  }

  void moveSelectedPoint(GeoPoint newPoint) {
    if (state.isSubmitting) return;
    final idx = state.selectedPointIndex;
    if (idx == null || idx >= state.roadPoints.length) return;

    final updated = List<GeoPoint>.from(state.roadPoints);
    updated[idx] = newPoint;

    safeEmit(
      state.copyWith(
        roadPoints: updated,
        selectedPointIndex: null,
        activeTool: StudioToolMode.drawRoad,
        successMessage: 'تم نقل النقطة بنجاح',
      ),
    );
  }

  void undoLastRoadPoint() {
    if (state.isSubmitting) return;
    if (state.roadPoints.isEmpty) return;
    final updated = List<GeoPoint>.from(state.roadPoints)..removeLast();
    safeEmit(state.copyWith(roadPoints: updated));
  }

  void clearRoadPoints() {
    if (state.isSubmitting) return;
    safeEmit(
      state.copyWith(
        roadPoints: const [],
        selectedPointIndex: null,
        activeTool:
            (state.activeTool == StudioToolMode.drawRoad ||
                state.activeTool == StudioToolMode.movePoint)
            ? StudioToolMode.none
            : state.activeTool,
      ),
    );
  }

  void addStop(GeoPoint point) {
    if (state.isSubmitting) return;
    final newStop = StudioStop(
      id: DateTime.now().millisecondsSinceEpoch,
      position: point,
      name: '',
    );

    final updatedStops = List<StudioStop>.from(state.stops)..add(newStop);
    safeEmit(state.copyWith(stops: updatedStops));
  }

  void removeStop(int index) {
    if (state.isSubmitting) return;
    if (index < 0 || index >= state.stops.length) return;

    final updatedStops = List<StudioStop>.from(state.stops);
    final removed = updatedStops.removeAt(index);
    removed.dispose();

    safeEmit(state.copyWith(stops: updatedStops));
  }

  void setSelectedColorIndex(int index) {
    if (state.isSubmitting) return;
    safeEmit(state.copyWith(selectedColorIndex: index));
  }

  void clearMessages() {
    safeEmit(
      state.copyWith(
        errorMessage: null,
        successMessage: null,
        submitSuccess: false,
        expandSectionIndex: null,
      ),
    );
  }

  Future<void> validateAndSubmit() async {
    if (state.isSubmitting) return;

    // 1. Validate Arabic route name
    if (nameArController.text.trim().isEmpty) {
      safeEmit(
        state.copyWith(
          errorMessage: 'يرجى إدخال اسم المسار بالعربية أولاً',
          expandSectionIndex: 4,
        ),
      );
      return;
    }

    // 2. Validate road points count
    if (state.roadPoints.length < 2) {
      safeEmit(
        state.copyWith(
          errorMessage: 'يرجى رسم نقطتين على الأقل لمسار الخط',
          expandSectionIndex: 1,
        ),
      );
      return;
    }

    // 3. Validate stops names
    bool hasEmptyStop = false;
    int firstEmptyIndex = -1;
    for (int i = 0; i < state.stops.length; i++) {
      if (state.stops[i].controller.text.trim().isEmpty) {
        state.stops[i].hasError = true;
        hasEmptyStop = true;
        if (firstEmptyIndex == -1) {
          firstEmptyIndex = i;
        }
      } else {
        state.stops[i].hasError = false;
      }
    }

    if (hasEmptyStop) {
      safeEmit(
        state.copyWith(
          stops: List<StudioStop>.from(state.stops),
          errorMessage:
              'يرجى كتابة اسم لجميع المحطات المضافة (المحطة رقم ${firstEmptyIndex + 1} فارغة)',
          expandSectionIndex: 2,
        ),
      );
      return;
    }

    if (state.selectedCity == null) {
      safeEmit(
        state.copyWith(
          errorMessage: 'يرجى اختيار المدينة أولاً',
          expandSectionIndex: 0,
        ),
      );
      return;
    }

    safeEmit(
      state.copyWith(
        errorMessage: null,
        isSubmitting: true,
        submitSuccess: false,
      ),
    );

    final routeFeature = NewTransitRouteFeature(
      type: 'Feature',
      properties: NewTransitRouteProperties(type: 'route'),
      geometry: NewTransitRouteGeometry.lineString(
        state.roadPoints.map((point) => point.toLngLat()).toList(),
      ),
    );

    final stopsFeature = state.stops.map((stop) {
      return NewTransitRouteFeature(
        type: 'Feature',
        properties: NewTransitRouteProperties(
          type: 'stop',
          nameAr: stop.controller.text.trim(),
        ),
        geometry: NewTransitRouteGeometry.point(
          stop.position.toLngLat(),
        ),
      );
    }).toList();

    final result = await _transitRepo.submitRoute(
      NewTransitRouteRequestBody(
        nameAr: nameArController.text.trim(),
        nameEn: nameEnController.text.trim(),
        price: int.tryParse(priceController.text.trim()) ?? 0,
        notes: notesController.text.trim(),
        colorIndex: state.selectedColorIndex,
        cityId: state.selectedCity!.id,
        geojson: NewTransitRouteGeoJson(
          type: 'FeatureCollection',
          features: [routeFeature, ...stopsFeature],
        ),
      ),
    );

    result.when(
      success: (_) {
        safeEmit(
          state.copyWith(
            errorMessage: null,
            successMessage:
                'تم إرسال المسار "${nameArController.text.trim()}" بنجاح!',
            isSubmitting: false,
            submitSuccess: true,
          ),
        );
      },
      error: (error) {
        final errorMessage = ApiErrorHandler.handleError(error);
        safeEmit(
          state.copyWith(
            errorMessage: errorMessage,
            successMessage: null,
            isSubmitting: false,
            submitSuccess: false,
          ),
        );
      },
    );
  }

  void resetAll() {
    if (state.isSubmitting) return;
    for (final stop in state.stops) {
      stop.dispose();
    }

    nameArController.clear();
    nameEnController.clear();
    priceController.clear();
    notesController.clear();

    safeEmit(
      state.copyWith(
        roadPoints: const [],
        stops: const [],
        selectedPointIndex: null,
        activeTool: StudioToolMode.none,
        selectedColorIndex: 0,
        expandSectionIndex: 0,
        successMessage: 'تمت إعادة ضبط جميع البيانات بنجاح',
      ),
    );

    if (state.cities.isEmpty) {
      loadCities();
    }
  }

  @override
  Future<void> close() {
    nameArController.dispose();
    nameEnController.dispose();
    priceController.dispose();
    notesController.dispose();
    for (final stop in state.stops) {
      stop.dispose();
    }
    return super.close();
  }
}
