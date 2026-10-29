import 'package:flutter/material.dart';

Widget buildStudioNodeMarker(bool isSelected, Color roadColor) {
  if (isSelected) {
    return Container(
      width: 38,
      height: 38,
      decoration: BoxDecoration(
        color: const Color(0xFFE65100),
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 3),
        boxShadow: const [
          BoxShadow(
            color: Color(0x66000000),
            blurRadius: 10,
            offset: Offset(0, 4),
          ),
        ],
      ),
      alignment: Alignment.center,
      child: const Icon(
        Icons.pan_tool_rounded,
        color: Colors.white,
        size: 20,
      ),
    );
  }

  return Container(
    width: 20,
    height: 20,
    decoration: BoxDecoration(
      color: roadColor,
      shape: BoxShape.circle,
      border: Border.all(color: Colors.white, width: 3.5),
      boxShadow: const [
        BoxShadow(
          color: Color(0x33000000),
          blurRadius: 4,
          offset: Offset(0, 2),
        ),
      ],
    ),
  );
}

Widget buildStudioStopMarker(int number) {
  return Container(
    width: 28,
    height: 28,
    decoration: BoxDecoration(
      color: const Color(0xFFAB6D17),
      shape: BoxShape.circle,
      border: Border.all(color: Colors.white, width: 2.5),
      boxShadow: const [
        BoxShadow(
          color: Color(0x33000000),
          blurRadius: 4,
          offset: Offset(0, 2),
        ),
      ],
    ),
    alignment: Alignment.center,
    child: Text(
      '$number',
      style: const TextStyle(
        color: Colors.white,
        fontSize: 12,
        fontWeight: FontWeight.bold,
      ),
    ),
  );
}

Widget buildUserLocationMarker() {
  return Stack(
    alignment: Alignment.center,
    children: [
      Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: const Color(0xFF1A73E8).withValues(alpha: 0.25),
        ),
      ),
      const Icon(
        Icons.circle,
        size: 22.0,
        color: Colors.white,
      ),
      const Icon(
        Icons.circle,
        size: 16.0,
        color: Color(0xFF1A73E8),
      ),
    ],
  );
}

Widget buildCityStopMarker() {
  return const Stack(
    alignment: Alignment.center,
    children: [
      Icon(
        Icons.circle,
        size: 22.0,
        color: Colors.white,
      ),
      Icon(
        Icons.circle,
        size: 16.0,
        color: Color(0xFFF59E0B),
      ),
    ],
  );
}
