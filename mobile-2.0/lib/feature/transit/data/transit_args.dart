class TransitArgs {
  final String cityId;
  final String cityName;
  final double? latitude;
  final double? longitude;
  final double? zoom;

  TransitArgs(this.cityId, this.cityName, {this.latitude, this.longitude, this.zoom});
}