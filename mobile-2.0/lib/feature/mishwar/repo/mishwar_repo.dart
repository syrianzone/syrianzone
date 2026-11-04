import 'package:dio/dio.dart';
import 'package:syrianzone/core/extensions/api_error_handler.dart';
import 'package:syrianzone/core/network/api_result.dart';
import 'package:syrianzone/core/network/api_service.dart';
import 'package:syrianzone/core/network/response/guides_response.dart';
import 'package:syrianzone/core/network/response/hotel_detail_response.dart';
import 'package:syrianzone/core/network/response/hotel_response.dart';
import 'package:syrianzone/core/network/response/place_detail_response.dart';
import 'package:syrianzone/core/network/response/places_map_response.dart';
import 'package:syrianzone/core/network/response/places_response.dart';
import 'package:syrianzone/core/network/response/submit_place_response.dart';

class MishwarRepo {
  final ApiService _apiService;
  MishwarRepo(this._apiService);

  Future<ApiResult<PlacesResponse>> getPlaces({
    String? category,
    String? query,
    String? sort,
    int? page,
    int? userId,
  }) async {
    try {
      final response = await _apiService.getPlaces(
        category: category,
        query: query,
        sort: sort,
        page: page,
        userId: userId,
      );
      return ApiResult.success(response);
    } catch (e) {
      return ApiResult.error(ApiErrorHandler.handleError(e));
    }
  }

  Future<ApiResult<PlacesMapResponse>> getPlacesMap() async {
    try {
      final response = await _apiService.getPlacesMap();
      return ApiResult.success(response);
    } catch (e) {
      return ApiResult.error(ApiErrorHandler.handleError(e));
    }
  }

  Future<ApiResult<PlaceDetailResponse>> getPlaceDetail(int id) async {
    try {
      final response = await _apiService.getPlaceDetail(id);
      return ApiResult.success(response);
    } catch (e) {
      return ApiResult.error(ApiErrorHandler.handleError(e));
    }
  }

  Future<ApiResult<HotelsResponse>> getHotels({
    String? city,
    String? query,
    int? minStars,
    int? page,
  }) async {
    try {
      final response = await _apiService.getHotels(
        city: city,
        query: query,
        minStars: minStars,
        page: page,
      );
      return ApiResult.success(response);
    } catch (e) {
      return ApiResult.error(ApiErrorHandler.handleError(e));
    }
  }

  Future<ApiResult<PlacesMapResponse>> getHotelsMap() async {
    try {
      final response = await _apiService.getHotelsMap();
      return ApiResult.success(response);
    } catch (e) {
      return ApiResult.error(ApiErrorHandler.handleError(e));
    }
  }

  Future<ApiResult<HotelDetailResponse>> getHotelDetail(int id) async {
    try {
      final response = await _apiService.getHotelDetail(id);
      return ApiResult.success(response);
    } catch (e) {
      return ApiResult.error(ApiErrorHandler.handleError(e));
    }
  }

  Future<ApiResult<GuidesResponse>> getGuides({String? sort}) async {
    try {
      final response = await _apiService.getGuides(sort: sort);
      return ApiResult.success(response);
    } catch (e) {
      return ApiResult.error(ApiErrorHandler.handleError(e));
    }
  }

  Future<ApiResult<SubmitPlaceResponse>> submitPlace({
    required String name,
    required String category,
    required String description,
    required double lat,
    required double lng,
    required List<String> photoPaths,
  }) async {
    try {
      final formData = FormData.fromMap({
        'name': name,
        'category': category,
        'description': description,
        'lat': lat,
        'lng': lng,
      });

      for (final path in photoPaths) {
        final fileName = path.split('/').last;
        formData.files.add(
          MapEntry(
            'photos[]',
            await MultipartFile.fromFile(path, filename: fileName),
          ),
        );
      }

      final response = await _apiService.submitPlace(formData);
      return ApiResult.success(response);
    } catch (e) {
      return ApiResult.error(ApiErrorHandler.handleError(e));
    }
  }
}
