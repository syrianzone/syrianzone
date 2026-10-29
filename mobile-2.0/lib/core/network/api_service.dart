import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';
import 'package:syrianzone/core/constants/api_service_constants.dart';
import 'package:syrianzone/core/network/response/city_response.dart';
import 'package:syrianzone/core/network/response/map_data_response.dart';
import 'package:syrianzone/core/network/response/nearby_stop_response.dart';
import 'package:syrianzone/core/network/response/transit_search_response.dart';

part 'api_service.g.dart';

@RestApi(baseUrl: ApiServiceConstants.baseUrl)
abstract class ApiService {
  factory ApiService(Dio dio) = _ApiService;

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
