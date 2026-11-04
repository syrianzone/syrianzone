import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';
import 'package:syrianzone/core/network/request/transit_route_request_body.dart';
import 'package:syrianzone/core/constants/api_service_constants.dart';
import 'package:syrianzone/core/network/response/auth_message_response.dart';
import 'package:syrianzone/core/network/response/auth_response.dart';
import 'package:syrianzone/core/network/response/city_response.dart';
import 'package:syrianzone/core/network/response/guides_response.dart';
import 'package:syrianzone/core/network/response/hotel_detail_response.dart';
import 'package:syrianzone/core/network/response/hotel_response.dart';
import 'package:syrianzone/core/network/response/map_data_response.dart';
import 'package:syrianzone/core/network/response/nearby_stop_response.dart';
import 'package:syrianzone/core/network/response/place_detail_response.dart';
import 'package:syrianzone/core/network/response/places_map_response.dart';
import 'package:syrianzone/core/network/response/places_response.dart';
import 'package:syrianzone/core/network/response/submit_place_response.dart';
import 'package:syrianzone/core/network/response/transit_search_response.dart';
import 'package:syrianzone/core/network/response/user_response.dart';
import 'package:syrianzone/core/network/response/user_submissions_response.dart';
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

  // Mishwar (Places)
  @GET("places")
  Future<PlacesResponse> getPlaces({
    @Query("category") String? category,
    @Query("q") String? query,
    @Query("sort") String? sort,
    @Query("page") int? page,
    @Query("user_id") int? userId,
  });

  @GET("places/map")
  Future<PlacesMapResponse> getPlacesMap();

  @GET("places/{id}")
  Future<PlaceDetailResponse> getPlaceDetail(@Path("id") int id);

  @POST("places")
  Future<SubmitPlaceResponse> submitPlace(@Body() FormData formData);

  // Hotels
  @GET("hotels")
  Future<HotelsResponse> getHotels({
    @Query("city") String? city,
    @Query("q") String? query,
    @Query("min_stars") int? minStars,
    @Query("page") int? page,
  });

  @GET("hotels/map")
  Future<PlacesMapResponse> getHotelsMap();

  @GET("hotels/{id}")
  Future<HotelDetailResponse> getHotelDetail(@Path("id") int id);

  // Guides
  @GET("guides")
  Future<GuidesResponse> getGuides({
    @Query("sort") String? sort,
  });
  @POST("studio/routes")
  Future<void> submitRoute(
    @Body() TransitRouteRequestBody requestBody,
  );

  @GET("studio/routes")
  Future<UserSubmissionsResponse> getUserSubmissions();

  @PUT("studio/routes/{id}")
  Future<void> updateRoute(
    @Path("id") int id,
    @Body() TransitRouteRequestBody requestBody,
  );

  @DELETE("studio/routes/{id}")
  Future<void> deleteRoute(
    @Path("id") int id,
  );
}
