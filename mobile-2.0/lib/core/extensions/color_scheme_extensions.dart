import 'package:flutter/material.dart';

extension ColorSchemeExtensions on BuildContext {
  ColorScheme get colorScheme => ColorScheme.of(this);
} 