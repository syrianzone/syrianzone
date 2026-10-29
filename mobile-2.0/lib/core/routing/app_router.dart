import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:syrianzone/core/di/get_it.dart';
import 'package:syrianzone/feature/transit/data/transit_args.dart';
import 'package:syrianzone/feature/transit/logic/transit_cubit.dart';
import 'package:syrianzone/feature/transit_cities/logic/transit_cities_cubit.dart';
import 'package:syrianzone/feature/transit_cities/repo/transit_cities_repo.dart';
import 'package:syrianzone/core/extensions/navigation_extensions.dart';
import 'package:syrianzone/core/routing/routes.dart';
import 'package:syrianzone/feature/home/ui/home_screen.dart';
import 'package:syrianzone/feature/transit/ui/transit_screen.dart';
import 'package:syrianzone/feature/transit_cities/ui/transit_cities_screen.dart';
import 'package:syrianzone/feature/transit_studio/logic/transit_studio_cubit.dart';
import 'package:syrianzone/feature/transit_studio/ui/transit_studio_screen.dart';
import 'package:syrianzone/core/widget/splash.dart';

class AppRouter {
  Route? generateRoute(RouteSettings settings) {
    final arguments = settings.arguments;
    switch (settings.name) {
      case Routes.splash:
        return MaterialPageRoute(
          builder: (context) => ZoneSplash(
            onFinished: () {
              context.pushReplacementNamed(Routes.home);
            },
          ),
        );

      case Routes.home:
        return MaterialPageRoute(builder: (_) => const HomeScreen());

      case Routes.transit:
        final transitArgs = arguments as TransitArgs;
        return MaterialPageRoute(
          builder: (_) => BlocProvider(
            create: (_) => getIt<TransitCubit>()..fetchMapData(transitArgs.cityId),
            child: TransitScreen(
              cityId: transitArgs.cityId,
              cityName: transitArgs.cityName,
              latitude: transitArgs.latitude,
              longitude: transitArgs.longitude,
              zoom: transitArgs.zoom,
            ),
          ),
        );

      case Routes.transitCities:
        return MaterialPageRoute(
          builder: (_) => BlocProvider(
            create: (_) =>
                TransitCitiesCubit(getIt<TransitCitiesRepo>())..loadCities(),
            child: const TransitCitiesScreen(),
          ),
        );

      case Routes.transitStudio:
        return MaterialPageRoute(
          builder: (_) => BlocProvider(
            create: (_) => getIt<TransitStudioCubit>()..loadCities(),
            child: const TransitStudioScreen(),
          ),
        );

      default:
        return null;
    }
  }
}
