import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:syrianzone/core/di/get_it.dart';
import 'package:syrianzone/core/routing/app_router.dart';
import 'package:syrianzone/core/routing/routes.dart';
import 'package:syrianzone/core/theme/app_theme.dart';
import 'package:syrianzone/l10n/app_localizations.dart';

void main() {
  setupGetIt();
  runApp(MyApp(appRouter: AppRouter()));
}

class MyApp extends StatelessWidget {
  final AppRouter appRouter;
  const MyApp({super.key, required this.appRouter});

  // This widget is the root of your application.
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Syrian Zone',
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.light,
      initialRoute: Routes.splash,
      onGenerateRoute: appRouter.generateRoute,
            localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
      
    );
  }
}
