import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';

class StudioStop {
  final int id;
  LatLng position;
  final TextEditingController controller;
  bool hasError;

  StudioStop({
    required this.id,
    required this.position,
    String name = '',
    this.hasError = false,
  }) : controller = TextEditingController(text: name);

  void dispose() {
    controller.dispose();
  }
}
