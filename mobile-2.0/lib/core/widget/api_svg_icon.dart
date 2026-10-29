import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

class ApiSvgIcon extends StatelessWidget {
  final String viewBox;
  final String path;
  final Color? color;

  const ApiSvgIcon({
    super.key,
    required this.viewBox,
    required this.path,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final svg = '''
      <svg xmlns="http://www.w3.org/2000/svg"
           viewBox="$viewBox">
        <path d="$path"
              ${color != null ? 'fill="${_colorToHex(color!)}"' : ''}
        />
      </svg>
    ''';

    return SvgPicture.string(
      svg,
      width: 24,
      height: 24,
    );
  }

  static String _colorToHex(Color color) {
    return '#${color.toARGB32().toRadixString(16).substring(2)}';
  }
}