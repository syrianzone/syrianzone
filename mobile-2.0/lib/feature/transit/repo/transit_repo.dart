import 'package:syrianzone/core/extensions/api_error_handler.dart';
import 'package:syrianzone/core/network/api_service.dart';
import 'package:syrianzone/core/network/response/map_data_response.dart';
import 'package:syrianzone/core/network/api_result.dart';
import 'package:syrianzone/core/network/response/transit_search_response.dart';
import 'package:syrianzone/core/network/response/nearby_stop_response.dart';

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
}
