import 'package:dio/dio.dart';
import 'package:get_it/get_it.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:syrianzone/core/network/api_service.dart';
import 'package:syrianzone/core/network/dio_factory.dart';
import 'package:syrianzone/core/storage/token_storage.dart';
import 'package:syrianzone/feature/auth/logic/auth_cubit.dart';
import 'package:syrianzone/feature/auth/repo/auth_repo.dart';
import 'package:syrianzone/feature/auth/util/auth_guard.dart';
import 'package:syrianzone/feature/transit/logic/transit_cubit.dart';
import 'package:syrianzone/feature/transit/repo/transit_repo.dart';
import 'package:syrianzone/feature/transit_cities/logic/transit_cities_cubit.dart';
import 'package:syrianzone/feature/transit_cities/repo/transit_cities_repo.dart';

final getIt = GetIt.instance;

Future<void> setupGetIt() async {
  // Storage
  final preferences = await SharedPreferences.getInstance();
  getIt.registerSingleton<SharedPreferences>(preferences);
  getIt.registerSingleton<TokenStorage>(TokenStorage(preferences: getIt()));

  // Networking
  getIt.registerSingleton<Dio>(DioFactory(getIt()).dio);
  getIt.registerSingleton<ApiService>(ApiService(getIt()));

  // Auth
  getIt.registerSingleton<AuthRepo>(AuthRepo(getIt(), getIt()));
  getIt.registerSingleton<AuthCubit>(AuthCubit(getIt()));
  getIt.registerLazySingleton<AuthGuard>(() => AuthGuard(getIt()));

  // Transit Features
  getIt.registerFactory<TransitCitiesRepo>(() => TransitCitiesRepo(getIt()));
  getIt.registerFactory<TransitCitiesCubit>(() => TransitCitiesCubit(getIt()));

  getIt.registerFactory<TransitRepo>(() => TransitRepo(getIt()));
  getIt.registerFactory<TransitCubit>(() => TransitCubit(getIt()));
}
