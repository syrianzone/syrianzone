import 'package:flutter/material.dart';

class ColorUtil {
  static Color hexToColor(String hex) {
    final cleaned = hex.replaceFirst('#', '');
    final withAlpha = cleaned.length == 6 ? 'FF$cleaned' : cleaned;
    return Color(int.parse(withAlpha, radix: 16));
  }
}