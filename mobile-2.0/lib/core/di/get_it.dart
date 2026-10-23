import 'package:dio/dio.dart';
import 'package:get_it/get_it.dart';
import 'package:syrianzone/core/network/api_service.dart';
import 'package:syrianzone/core/network/dio_factory.dart';
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
}
