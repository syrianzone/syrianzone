import 'package:flutter/material.dart';

/// Syrian Zone color palette extracted from https://syrian.zone
/// Colors are defined in HSL format and converted to Flutter Color objects
class AppColors {
  AppColors._();

  // Light Mode Colors
  static const Color lightBackground = Color(0xFFFFFFFF); // hsl(0 0% 100%)
  static const Color lightForeground = Color(0xFF0A0A0A); // hsl(0 0% 3.9%)
  static const Color lightCard = Color(0xFFFFFFFF); // hsl(0 0% 100%)
  static const Color lightCardForeground = Color(0xFF0A0A0A); // hsl(0 0% 3.9%)
  static const Color lightPrimary = Color(0xFF4B7F52); // hsl(105 15.2% 36.1%)
  static const Color lightPrimaryForeground = Color(0xFFFAFAFA); // hsl(0 0% 98%)
  static const Color lightSecondary = Color(0xFFF5F5F5); // hsl(0 0% 96.1%)
  static const Color lightSecondaryForeground = Color(0xFF171717); // hsl(0 0% 9%)
  static const Color lightMuted = Color(0xFFF5F5F5); // hsl(0 0% 96.1%)
  static const Color lightMutedForeground = Color(0xFF737373); // hsl(0 0% 45.1%)
  static const Color lightAccent = Color(0xFFF5F5F5); // hsl(0 0% 96.1%)
  static const Color lightAccentForeground = Color(0xFF171717); // hsl(0 0% 9%)
  static const Color lightDestructive = Color(0xFFB23A48); // hsl(356 45.2% 45.1%)
  static const Color lightDestructiveForeground = Color(0xFFFAFAFA); // hsl(0 0% 98%)
  static const Color lightBorder = Color(0xFFE5E5E5); // hsl(0 0% 89.8%)
  static const Color lightInput = Color(0xFFE5E5E5); // hsl(0 0% 89.8%)
  static const Color lightRing = Color(0xFF4B7F52); // hsl(105 15.2% 36.1%)

  // Dark Mode Colors
  static const Color darkBackground = Color(0xFF1A1F1E); // hsl(203 13.3% 11.8%)
  static const Color darkForeground = Color(0xFFFFFFFF); // hsl(0 0% 100%)
  static const Color darkCard = Color(0xFF0D1412); // hsl(195 23.5% 6.7%)
  static const Color darkCardForeground = Color(0xFFFFFFFF); // hsl(0 0% 100%)
  static const Color darkPrimary = Color(0xFF4B7F52); // hsl(105 15.2% 36.1%)
  static const Color darkPrimaryForeground = Color(0xFFFFFFFF); // hsl(0 0% 100%)
  static const Color darkSecondary = Color(0xFF1F2624); // hsl(200 15% 12%)
  static const Color darkSecondaryForeground = Color(0xFFFFFFFF); // hsl(0 0% 100%)
  static const Color darkMuted = Color(0xFF141A19); // hsl(195 23.5% 10%)
  static const Color darkMutedForeground = Color(0xFFA3ABA9); // hsl(200 10% 65%)
  static const Color darkAccent = Color(0xFF1F2624); // hsl(200 15% 12%)
  static const Color darkAccentForeground = Color(0xFFFFFFFF); // hsl(0 0% 100%)
  static const Color darkDestructive = Color(0xFFB23A48); // hsl(356 45.2% 45.1%)
  static const Color darkDestructiveForeground = Color(0xFFFFFFFF); // hsl(0 0% 100%)
  static const Color darkBorder = Color(0x1AFFFFFF); // hsl(0 0% 100% / 10%)
  static const Color darkInput = Color(0x1AFFFFFF); // hsl(0 0% 100% / 10%)
  static const Color darkRing = Color(0xFF4B7F52); // hsl(105 15.2% 36.1%)

  // Semantic Colors (used across both themes)
  static const Color szColorPrimary = Color(0xFF4B7F52); // hsl(105 15.2% 36.1%)
  static const Color szColorAccent = Color(0xFFB23A48); // hsl(356 45.2% 45.1%)

  // Chart Colors
  static const Color chart1 = Color(0xFFEB6B56); // hsl(12 76% 61%)
  static const Color chart2 = Color(0xFF4A9B8E); // hsl(173 58% 39%)
  static const Color chart3 = Color(0xFF2A5F6F); // hsl(197 37% 24%)
  static const Color chart4 = Color(0xFFE8C468); // hsl(43 74% 66%)
  static const Color chart5 = Color(0xFFF5A962); // hsl(27 87% 67%)

  // Figure Colors (for data visualization)
  static const Color figFounder = Color(0xFF3B82F6); // #3b82f6
  static const Color figBaath = Color(0xFFEF4444); // #ef4444
  static const Color figIslam = Color(0xFF16A34A); // #16a34a
  static const Color figCiv = Color(0xFFCA8A04); // #ca8a04
  static const Color figKurd = Color(0xFF9333EA); // #9333ea
  static const Color figMinority = Color(0xFFEA580C); // #ea580c
  static const Color figCurrent = Color(0xFF0284C7); // #0284c7

  // Alignment Colors (for political/geographical alignments)
  static const Color alignWest = Color(0xFF2563EB); // #2563eb
  static const Color alignGulf = Color(0xFF059669); // #059669
  static const Color alignTurkish = Color(0xFFDC2626); // #dc2626
  static const Color alignEast = Color(0xFF7C3AED); // #7c3aed
  static const Color alignNeutral = Color(0xFF64748B); // #64748b
}
