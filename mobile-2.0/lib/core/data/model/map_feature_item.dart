abstract interface class MapFeatureItem {
  int get id;
  double get latitude;
  double get longitude;
  String get displayName;
  String get mapType; // 'place' or 'hotel'
  int? get userId;
}
