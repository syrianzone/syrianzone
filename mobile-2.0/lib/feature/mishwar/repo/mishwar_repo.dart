import 'package:dio/dio.dart';
import 'package:syrianzone/core/extensions/api_error_handler.dart';
import 'package:syrianzone/core/network/api_result.dart';
import 'package:syrianzone/core/network/api_service.dart';
import 'package:syrianzone/core/network/response/guides_response.dart';
import 'package:syrianzone/core/network/response/hotel_detail_response.dart';
import 'package:syrianzone/core/network/response/hotel_response.dart';
import 'package:syrianzone/core/network/response/place_detail_response.dart';
import 'package:syrianzone/core/network/response/place_photos_response.dart';
import 'package:syrianzone/core/network/response/places_map_response.dart';
import 'package:syrianzone/core/network/response/places_response.dart';
import 'package:syrianzone/core/network/response/save_place_response.dart';
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
    CancelToken? cancelToken,
  }) async {
    try {
      final response = await _apiService.getPlaces(
        category: category,
        query: query,
        sort: sort,
        page: page,
        userId: userId,
        cancelToken: cancelToken,
      );
      return ApiResult.success(response);
    } catch (e) {
      return ApiResult.error(ApiErrorHandler.handleError(e));
    }
  }

  Future<ApiResult<PlacePhotosResponse>> getPlacePhotos({
    int? page,
    int? userId,
    CancelToken? cancelToken,
  }) async {
    try {
      final response = await _apiService.getPlacePhotos(
        page: page,
        userId: userId,
        cancelToken: cancelToken,
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
    CancelToken? cancelToken,
  }) async {
    try {
      final response = await _apiService.getHotels(
        city: city,
        query: query,
        minStars: minStars,
        page: page,
        cancelToken: cancelToken,
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

  Future<ApiResult<GuidesResponse>> getGuides({String? sort, CancelToken? cancelToken}) async {
    try {
      final response = await _apiService.getGuides(sort: sort, cancelToken: cancelToken);
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

  Future<ApiResult<SavePlaceResponse>> savePlace(int id) async {
    try {
      final response = await _apiService.savePlace(id);
      return ApiResult.success(response);
    } catch (e) {
      return ApiResult.error(ApiErrorHandler.handleError(e));
    }
  }

  Future<ApiResult<SavePlaceResponse>> unsavePlace(int id) async {
    try {
      final response = await _apiService.unsavePlace(id);
      return ApiResult.success(response);
    } catch (e) {
      return ApiResult.error(ApiErrorHandler.handleError(e));
    }
  }

  /// Returns the server's confirmation message.
  Future<ApiResult<String>> reportPlace(
    int id, {
    required String reason,
    String? details,
  }) async {
    try {
      final response = await _apiService.reportPlace(id, {
        'reason': reason,
        if (details != null && details.isNotEmpty) 'details': details,
      });
      return ApiResult.success(
        response['message'] as String? ?? 'شكراً لك، سنراجع البلاغ قريباً',
      );
    } catch (e) {
      return ApiResult.error(ApiErrorHandler.handleError(e));
    }
  }

  Future<ApiResult<PlacesResponse>> getMySavedPlaces({int page = 1}) async {
    try {
      final response = await _apiService.getMySavedPlaces(page: page);
      return ApiResult.success(response);
    } catch (e) {
      return ApiResult.error(ApiErrorHandler.handleError(e));
    }
  }

  Future<ApiResult<PlacesResponse>> getMyPlaces({int page = 1}) async {
    try {
      final response = await _apiService.getMyPlaces(page: page);
      return ApiResult.success(response);
    } catch (e) {
      return ApiResult.error(ApiErrorHandler.handleError(e));
    }
  }
}
