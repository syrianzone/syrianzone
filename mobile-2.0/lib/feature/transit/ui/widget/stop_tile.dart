import 'package:flutter/material.dart';
import 'package:syrianzone/core/util/text_util.dart';
import 'package:syrianzone/feature/transit/ui/transit_screen.dart';

class StopTile extends StatelessWidget {
  const StopTile({
    super.key,
    required this.index,
    required this.stopName,
    this.onTap,
  });

  final int index;
  final String stopName;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: TransitScreen.cardBorder),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
          child: Row(
            children: [
              Transform.rotate(
                angle: -0.5,
                child: const Icon(Icons.navigation_outlined, color: Color(0xFFA05A00)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  stopName,
                  textAlign: TextAlign.right,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w500,
                    color: TransitScreen.titleColor,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Container(
                height: 48,
                width: 48,
                decoration: const BoxDecoration(
                  color: Color(0xFFF4F0EA),
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Text(
                  TextUtil.toArabicDigits(index + 1),
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: TransitScreen.metaColor,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
