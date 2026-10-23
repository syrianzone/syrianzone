import 'package:flutter/material.dart';

extension TextThemeExtensions on BuildContext {
  TextTheme get textTheme => Theme.of(this).textTheme;
}