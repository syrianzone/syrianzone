class MishwarMapPoint {
  final int id;
  final String name;
  final double lat;
  final double lng;
  final String? type; // 'place' or 'hotel'

  const MishwarMapPoint({
    required this.id,
    required this.name,
    required this.lat,
    required this.lng,
    this.type = 'place',
  });
}
