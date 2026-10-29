import 'package:syrianzone/core/extensions/api_error_handler.dart';
import 'package:syrianzone/core/network/api_service.dart';
import 'package:syrianzone/core/network/api_result.dart';
import 'package:syrianzone/core/network/response/city_response.dart';

class TransitCitiesRepo {
  final ApiService _apiService;

  TransitCitiesRepo(this._apiService);

  Future<ApiResult<List<CityResponse>>> fetchTransitCities() async {
    try {
      final cities = await _apiService.getTransitCities();
      return ApiResult.success(cities);
    } catch (e) {
      return ApiResult.error(ApiErrorHandler.handleError(e));
    }
  }
}
