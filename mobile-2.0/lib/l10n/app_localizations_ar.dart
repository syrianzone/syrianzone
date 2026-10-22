// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Arabic (`ar`).
class AppLocalizationsAr extends AppLocalizations {
  AppLocalizationsAr([String locale = 'ar']) : super(locale);

  @override
  String stops(int count, String formattedCount) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$formattedCount موقف',
      many: '$formattedCount موقف',
      few: '$formattedCount مواقف',
      two: 'موقفان',
      one: 'موقف واحد',
      zero: 'لا يوجد مواقف',
    );
    return '$_temp0';
  }

  @override
  String routes(int count, String formattedCount) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$formattedCount خط',
      many: '$formattedCount خط',
      few: '$formattedCount خطوط',
      two: 'خطان',
      one: 'خط واحد',
      zero: 'لا يوجد خطوط',
    );
    return '$_temp0';
  }
}
