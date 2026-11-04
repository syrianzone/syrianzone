abstract class MishwarSheetConstants {
  static const double minFraction = 0.20;
  static const double collapsedFraction = 0.22;
  static const double midFraction = 0.58;
  static const double maxFraction = 0.85;

  static const double swipeUpThreshold = 0.40;
  static const double swipeDownThreshold = 0.70;
  static const double tapExpandThreshold = 0.75;
  static const double scrollExpandThreshold = 0.84;

  static const List<double> snapPoints = [
    collapsedFraction,
    midFraction,
    maxFraction,
  ];

  // Place & Hotel detail bottom sheets
  static const double detailMinFraction = 0.40;
  static const double detailInitialFraction = 0.92;
  static const double detailMaxFraction = 0.95;
}
