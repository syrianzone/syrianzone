import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';
import 'package:syrianzone/core/constants/api_service_constants.dart';
import 'package:syrianzone/core/network/response/auth_message_response.dart';
import 'package:syrianzone/core/network/response/auth_response.dart';
import 'package:syrianzone/core/network/response/city_response.dart';
import 'package:syrianzone/core/network/response/map_data_response.dart';
import 'package:syrianzone/core/network/response/nearby_stop_response.dart';
import 'package:syrianzone/core/network/response/transit_search_response.dart';
import 'package:syrianzone/core/network/response/user_response.dart';
import 'package:syrianzone/feature/auth/data/models/google_token_request.dart';

part 'api_service.g.dart';

@RestApi(baseUrl: ApiServiceConstants.baseUrl)
abstract class ApiService {
  factory ApiService(Dio dio) = _ApiService;

  // Authentication
  @POST("auth/google/token")
  Future<AuthResponse> exchangeGoogleToken(@Body() GoogleTokenRequest request);

  @GET("auth/user")
  Future<UserResponse> getAuthUser();

  @POST("auth/logout")
  Future<AuthMessageResponse> logout();

  @POST("auth/logout-devices")
  Future<AuthMessageResponse> logoutAllDevices();

  // Transit
  @GET("transit/cities")
  Future<List<CityResponse>> getTransitCities();

  @GET("transit/cities/{id}/map-data")
  Future<MapDataResponse> getMapData(@Path("id") String cityId);

  @GET("transit/search")
  Future<TransitSearchResponse> searchTransit(
    @Query("q") String query,
    @Query("city_id") String cityId,
  );

  @GET("transit/stops/nearby")
  Future<List<NearbyStopResponse>> getNearbyStops(
    @Query("lat") double latitude,
    @Query("lng") double longitude,
  );
}
