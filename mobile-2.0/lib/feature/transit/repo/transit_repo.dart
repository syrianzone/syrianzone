import 'package:syrianzone/core/extensions/api_error_handler.dart';
import 'package:syrianzone/core/network/api_service.dart';
import 'package:syrianzone/core/network/request/transit_route_request_body.dart';
import 'package:syrianzone/core/network/response/city_response.dart';
import 'package:syrianzone/core/network/response/map_data_response.dart';
import 'package:syrianzone/core/network/api_result.dart';
import 'package:syrianzone/core/network/response/transit_search_response.dart';
import 'package:syrianzone/core/network/response/nearby_stop_response.dart';
import 'package:syrianzone/core/network/response/user_submissions_response.dart';

class TransitRepo {
  final ApiService _apiService;
  TransitRepo(this._apiService);

  Future<ApiResult<MapDataResponse>> fetchMapData(String cityId) async {
    try {
      final response = await _apiService.getMapData(cityId);
      return ApiResult.success(response);
    } catch (e) {
      return ApiResult.error(ApiErrorHandler.handleError(e));
    }
  }

  Future<ApiResult<TransitSearchResponse>> searchTransit(
    String query,
    String cityId,
  ) async {
    try {
      final response = await _apiService.searchTransit(query, cityId);
      return ApiResult.success(response);
    } catch (e) {
      return ApiResult.error(ApiErrorHandler.handleError(e));
    }
  }

  Future<ApiResult<List<NearbyStopResponse>>> getNearbyStops(
    double latitude,
    double longitude,
  ) async {
    try {
      final response = await _apiService.getNearbyStops(latitude, longitude);
      return ApiResult.success(response);
    } catch (e) {
      return ApiResult.error(ApiErrorHandler.handleError(e));
    }
  }

  Future<ApiResult<List<CityResponse>>> getTransitCities() async {
    try {
      final response = await _apiService.getTransitCities();
      return ApiResult.success(response);
    } catch (e) {
      return ApiResult.error(ApiErrorHandler.handleError(e));
    }
  }


  Future<ApiResult<void>> submitRoute(TransitRouteRequestBody requestBody) async {
    try {
      await _apiService.submitRoute(requestBody);
      return ApiResult.success(null);
    } catch (e) {
      return ApiResult.error(ApiErrorHandler.handleError(e));
    }
  }

  Future<ApiResult<UserSubmissionsResponse>> getUserSubmissions() async {
    try {
      final response = await _apiService.getUserSubmissions();
      return ApiResult.success(response);
    } catch (e) {
      return ApiResult.error(ApiErrorHandler.handleError(e));
    }
  }

  Future<ApiResult<void>> updateRoute(
    int id,
    TransitRouteRequestBody requestBody,
  ) async {
    try {
      await _apiService.updateRoute(id, requestBody);
      return ApiResult.success(null);
    } catch (e) {
      return ApiResult.error(ApiErrorHandler.handleError(e));
    }
  }

  Future<ApiResult<void>> deleteRoute(int id) async {
    try {
      await _apiService.deleteRoute(id);
      return ApiResult.success(null);
    } catch (e) {
      return ApiResult.error(ApiErrorHandler.handleError(e));
    }
  }
}
