import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:url_launcher/url_launcher.dart';

class MapUtil {
  static Future<void> openMapApp(
    double lat,
    double lng, {
    String? label,
  }) async {
    final encodedLabel = label != null ? Uri.encodeComponent(label) : '';
    final Uri geoUri = Uri.parse('geo:$lat,$lng?q=$lat,$lng($encodedLabel)');
    final Uri appleUri = Uri.parse(
      'https://maps.apple.com/?ll=$lat,$lng&q=$encodedLabel',
    );
    final Uri webUri = Uri.parse(
      'https://www.google.com/maps/search/?api=1&query=$lat,$lng',
    );

    try {
      if (!kIsWeb && Platform.isIOS) {
        if (await canLaunchUrl(appleUri)) {
          await launchUrl(appleUri, mode: LaunchMode.externalApplication);
          return;
        }
      } else if (!kIsWeb && Platform.isAndroid) {
        await launchUrl(geoUri, mode: LaunchMode.externalApplication);
        return;
      }
    } catch (_) {
      // Fall through to webUri fallback
    }

    if (await canLaunchUrl(webUri)) {
      await launchUrl(webUri, mode: LaunchMode.externalApplication);
    }
  }
}
