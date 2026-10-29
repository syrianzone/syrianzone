# Syrian Zone Mobile App - Theme Setup

This document describes the theme configuration extracted from [https://syrian.zone](https://syrian.zone) and applied to the Flutter mobile app.

## Font

**IBM Plex Sans Arabic** - Loaded via Google Fonts package
- Used across the entire application
- Supports both Latin and Arabic scripts
- Matches the web version font exactly

## Color Palette

### Light Mode
- **Background**: `#FFFFFF` (hsl 0 0% 100%)
- **Foreground**: `#0A0A0A` (hsl 0 0% 3.9%)
- **Primary**: `#4B7F52` (hsl 105 15.2% 36.1%) - Green
- **Primary Foreground**: `#FAFAFA` (hsl 0 0% 98%)
- **Secondary**: `#F5F5F5` (hsl 0 0% 96.1%)
- **Destructive**: `#B23A48` (hsl 356 45.2% 45.1%) - Red
- **Border**: `#E5E5E5` (hsl 0 0% 89.8%)
- **Muted**: `#F5F5F5` with muted foreground `#737373`

### Dark Mode
- **Background**: `#1A1F1E` (hsl 203 13.3% 11.8%)
- **Foreground**: `#FFFFFF` (hsl 0 0% 100%)
- **Primary**: `#4B7F52` (hsl 105 15.2% 36.1%) - Same green as light mode
- **Card**: `#0D1412` (hsl 195 23.5% 6.7%)
- **Secondary**: `#1F2624` (hsl 200 15% 12%)
- **Destructive**: `#B23A48` (hsl 356 45.2% 45.1%) - Same red as light mode
- **Border**: `rgba(255, 255, 255, 0.1)` (10% white)
- **Muted**: `#141A19` with muted foreground `#A3ABA9`

### Special Purpose Colors

#### Chart Colors (for data visualization)
- Chart 1: `#EB6B56` - Coral red
- Chart 2: `#4A9B8E` - Teal
- Chart 3: `#2A5F6F` - Dark cyan
- Chart 4: `#E8C468` - Yellow
- Chart 5: `#F5A962` - Orange

#### Figure Colors (political/organizational affiliations)
- Founder: `#3B82F6` - Blue
- Baath: `#EF4444` - Red
- Islam: `#16A34A` - Green
- Civil: `#CA8A04` - Gold
- Kurdish: `#9333EA` - Purple
- Minority: `#EA580C` - Orange
- Current: `#0284C7` - Cyan

#### Alignment Colors (geopolitical alignments)
- West: `#2563EB` - Blue
- Gulf: `#059669` - Green
- Turkish: `#DC2626` - Red
- East: `#7C3AED` - Purple
- Neutral: `#64748B` - Gray

## Design System

### Border Radius
- Default: 8px (0.5rem from the website)
- Applied to cards, buttons, inputs

### Typography Scale
Matches the Tailwind CSS typography scale from the website:
- Display Large: 48px (3rem)
- Display Medium: 36px (2.25rem)
- Display Small: 30px (1.875rem)
- Headline Medium: 24px (1.5rem)
- Headline Small: 20px (1.25rem)
- Title Large: 18px (1.125rem)
- Body Large: 16px (1rem) - Default
- Body Medium: 14px (0.875rem)
- Body Small: 12px (0.75rem)

## Implementation Files

1. **`lib/core/theme/app_colors.dart`**
   - Defines all color constants for light and dark modes
   - Includes semantic colors, chart colors, and special purpose colors

2. **`lib/core/theme/app_theme.dart`**
   - Configures complete Material 3 themes
   - Sets up typography with IBM Plex Sans Arabic
   - Defines button styles, input decorations, card styles
   - Implements both light and dark themes

3. **`lib/main.dart`**
   - Applies themes to MaterialApp
   - Enables automatic theme switching based on system preference
   - Uses `ThemeMode.system` for automatic light/dark mode

## Usage

The theme is automatically applied to all widgets in the app. To access theme colors:

```dart
// Access theme colors
final primaryColor = Theme.of(context).colorScheme.primary;
final backgroundColor = Theme.of(context).scaffoldBackgroundColor;

// Access custom colors directly
import 'package:syrianzone/core/theme/app_colors.dart';
final chartColor = AppColors.chart1;
final founderColor = AppColors.figFounder;
```

## Theme Mode

The app automatically switches between light and dark themes based on system preferences. This can be changed in `main.dart` by modifying the `themeMode` parameter:

- `ThemeMode.system` - Follow system preference (default)
- `ThemeMode.light` - Always use light theme
- `ThemeMode.dark` - Always use dark theme

## Dependencies

- `google_fonts: ^6.2.1` - For IBM Plex Sans Arabic font
