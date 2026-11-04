import 'package:dio/dio.dart';
import 'package:get_it/get_it.dart';
import 'package:syrianzone/core/network/api_service.dart';
import 'package:syrianzone/core/network/dio_factory.dart';
import 'package:syrianzone/feature/mishwar/logic/guide/guide_detail_cubit.dart';
import 'package:syrianzone/feature/mishwar/logic/hotel/hotel_detail_cubit.dart';
import 'package:syrianzone/feature/mishwar/logic/mishwar_cubit.dart';
import 'package:syrianzone/feature/mishwar/logic/place/place_detail_cubit.dart';
import 'package:syrianzone/feature/mishwar/repo/mishwar_repo.dart';
import 'package:syrianzone/feature/transit/logic/transit_cubit.dart';
import 'package:syrianzone/feature/transit/repo/transit_repo.dart';
import 'package:syrianzone/feature/transit_cities/logic/transit_cities_cubit.dart';
import 'package:syrianzone/feature/transit_cities/repo/transit_cities_repo.dart';

final getIt = GetIt.instance;

void setupGetIt() {
  getIt.registerSingleton<Dio>(DioFactory().dio);
  getIt.registerSingleton(ApiService(getIt()));
  
  getIt.registerFactory<TransitCitiesRepo>(() => TransitCitiesRepo(getIt()));
  getIt.registerFactory<TransitCitiesCubit>(() => TransitCitiesCubit(getIt()));

  getIt.registerFactory<TransitRepo>(() => TransitRepo(getIt()));
  getIt.registerFactory<TransitCubit>(() => TransitCubit(getIt()));

  getIt.registerLazySingleton<MishwarRepo>(() => MishwarRepo(getIt()));
  getIt.registerFactory<MishwarCubit>(() => MishwarCubit(getIt()));
  getIt.registerFactory<PlaceDetailCubit>(() => PlaceDetailCubit(getIt()));
  getIt.registerFactory<HotelDetailCubit>(() => HotelDetailCubit(getIt()));
  getIt.registerFactory<GuideDetailCubit>(() => GuideDetailCubit());
}
