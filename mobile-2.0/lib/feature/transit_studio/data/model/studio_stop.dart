import 'package:flutter/material.dart';
import 'package:flutter_osm_plugin/flutter_osm_plugin.dart';

class StudioStop {
  final int id;
  GeoPoint position;
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
