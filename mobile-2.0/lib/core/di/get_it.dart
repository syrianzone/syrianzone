import 'package:dio/dio.dart';
import 'package:get_it/get_it.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:syrianzone/core/network/api_service.dart';
import 'package:syrianzone/core/network/dio_factory.dart';
import 'package:syrianzone/feature/mishwar/logic/guide/guide_detail_cubit.dart';
import 'package:syrianzone/feature/mishwar/logic/hotel/hotel_detail_cubit.dart';
import 'package:syrianzone/feature/mishwar/logic/mishwar_cubit.dart';
import 'package:syrianzone/feature/mishwar/logic/place/place_detail_cubit.dart';
import 'package:syrianzone/feature/mishwar/repo/mishwar_repo.dart';
import 'package:syrianzone/core/storage/token_storage.dart';
import 'package:syrianzone/feature/auth/logic/auth_cubit.dart';
import 'package:syrianzone/feature/auth/repo/auth_repo.dart';
import 'package:syrianzone/feature/auth/util/auth_guard.dart';
import 'package:syrianzone/feature/transit/logic/transit_cubit.dart';
import 'package:syrianzone/feature/transit/repo/transit_repo.dart';
import 'package:syrianzone/feature/transit_cities/logic/transit_cities_cubit.dart';
import 'package:syrianzone/feature/transit_cities/repo/transit_cities_repo.dart';
import 'package:syrianzone/feature/transit_studio/logic/transit_studio_cubit.dart';
import 'package:syrianzone/feature/transit_submissions/logic/transit_submissions_cubit.dart';

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

  getIt.registerLazySingleton<MishwarRepo>(() => MishwarRepo(getIt()));
  getIt.registerFactory<MishwarCubit>(() => MishwarCubit(getIt()));
  getIt.registerFactory<PlaceDetailCubit>(() => PlaceDetailCubit(getIt()));
  getIt.registerFactory<HotelDetailCubit>(() => HotelDetailCubit(getIt()));
  getIt.registerFactory<GuideDetailCubit>(() => GuideDetailCubit());
  getIt.registerFactory<TransitStudioCubit>(() => TransitStudioCubit(getIt()));
  getIt.registerFactory<TransitSubmissionsCubit>(
      () => TransitSubmissionsCubit(getIt()));
}
