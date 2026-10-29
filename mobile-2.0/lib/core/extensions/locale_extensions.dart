import 'package:flutter/material.dart';
import 'package:syrianzone/l10n/app_localizations.dart';


extension LocaleExtensions on BuildContext {
  AppLocalizations get appLocalizations => AppLocalizations.of(this)!; 
}