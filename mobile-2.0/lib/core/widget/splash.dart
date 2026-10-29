
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

class ZoneSplash extends StatefulWidget {
  const ZoneSplash({
    super.key,
    // required this.child,
    this.onFinished,
  });

  /// The screen revealed behind the splash.
  // final Widget child;

  /// Called after the splash animation finishes.
  final VoidCallback? onFinished;

  @override
  State<ZoneSplash> createState() => _ZoneSplashState();
}

class _ZoneSplashState extends State<ZoneSplash>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _scale;
  late final Animation<double> _reveal;
  late final Animation<double> _tunnelFade;

  bool _showSplash = true;

  // Your SVG viewBox: 570.55077 x 298.42888.
  static const double _svgWidth = 570.55077;
  static const double _svgHeight = 298.42888;

  // Approximate center of the green O in the SVG.
  static const Alignment _oAlignment = Alignment(
    -0.117,
    0.367,
  );

  static const Color _backgroundColor = Color(0xFFFFFBF2);
  static const double _stillPhase = 0.2;

  @override
  void initState() {
    super.initState();

    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    );

    _scale = Tween<double>(
      begin: 1.0,
      end: 25.0,
    ).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(
          _stillPhase,
          1.0,
          curve: Curves.easeInCubic,
        ),
      ),
    );

    _reveal = CurvedAnimation(
      parent: _controller,
      curve: const Interval(
        _stillPhase,
        1.0,
        curve: Curves.easeInCubic,
      ),
    );

    _tunnelFade = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(
          _stillPhase,
          0.75,
          curve: Curves.easeIn,
        ),
      ),
    );

    _controller.addStatusListener(_handleAnimationStatus);
    _startAnimationAfterDelay();
  }

  Future<void> _startAnimationAfterDelay() async {
    await Future<void>.delayed(
      const Duration(seconds: 2),
    );

    if (!mounted) {
      return;
    }

    _controller.forward();
  }

  void _handleAnimationStatus(AnimationStatus status) {
    if (status == AnimationStatus.completed && mounted) {
      setState(() {
        _showSplash = false;
      });

      widget.onFinished?.call();
    }
  }

  @override
  void dispose() {
    _controller.removeStatusListener(_handleAnimationStatus);
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _backgroundColor,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // widget.child,

          if (_showSplash)
            LayoutBuilder(
              builder: (context, constraints) {
                final screenSize = Size(
                  constraints.maxWidth,
                  constraints.maxHeight,
                );

                // Responsive logo size.
                final logoWidth = math.min(
                  screenSize.width * 0.72,
                  340.0,
                );

                final logoHeight =
                    logoWidth * _svgHeight / _svgWidth;

                // Position of the O in screen coordinates.
                final focalPoint = Offset(
                  screenSize.width / 2 +
                      _oAlignment.x * logoWidth / 2,
                  screenSize.height / 2 +
                      _oAlignment.y * logoHeight / 2,
                );

                // Radius required to cover every screen corner.
                final maxRadius = [
                  Offset.zero,
                  Offset(screenSize.width, 0),
                  Offset(0, screenSize.height),
                  Offset(
                    screenSize.width,
                    screenSize.height,
                  ),
                ].map((corner) {
                  return (corner - focalPoint).distance;
                }).reduce(math.max);

                return AnimatedBuilder(
                  animation: _controller,
                  builder: (context, _) {
                    final radius =
                        maxRadius * _reveal.value;
                    final tunnelMix = _tunnelFade.value;
                    final tunnelBackground = Color.lerp(
                      _backgroundColor,
                      Colors.black,
                      tunnelMix,
                    );

                    return ClipPath(
                      clipper: _CircularHoleClipper(
                        center: focalPoint,
                        radius: radius,
                      ),
                      child: SizedBox.expand(
                        child: Stack(
                          fit: StackFit.expand,
                          children: [
                            ColoredBox(
                              color:
                                  tunnelBackground ??
                                  _backgroundColor,
                            ),
                            IgnorePointer(
                              child: DecoratedBox(
                                decoration: BoxDecoration(
                                  gradient: RadialGradient(
                                    center: _oAlignment,
                                    radius: 1.05,
                                    colors: [
                                      Colors.transparent,
                                      Colors.black.withValues(
                                        alpha:
                                            tunnelMix * 0.35,
                                      ),
                                    ],
                                    stops: const [0.25, 1.0],
                                  ),
                                ),
                              ),
                            ),
                            Center(
                              child: Transform.scale(
                                scale: _scale.value,
                                alignment: _oAlignment,
                                child: SizedBox(
                                  width: logoWidth,
                                  height: logoHeight,
                                  child: SvgPicture.asset(
                                    'assets/images/logo-lightmode.svg',
                                    width: logoWidth,
                                    height: logoHeight,
                                    fit: BoxFit.contain,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                );
              },
            ),
        ],
      ),
    );
  }
}

/// Clips out a growing circle, revealing the screen behind it.
class _CircularHoleClipper extends CustomClipper<Path> {
  const _CircularHoleClipper({
    required this.center,
    required this.radius,
  });

  final Offset center;
  final double radius;

  @override
  Path getClip(Size size) {
    return Path()
      ..fillType = PathFillType.evenOdd
      ..addRect(Offset.zero & size)
      ..addOval(
        Rect.fromCircle(
          center: center,
          radius: radius,
        ),
      );
  }

  @override
  bool shouldReclip(covariant _CircularHoleClipper oldClipper) {
    return oldClipper.center != center ||
        oldClipper.radius != radius;
  }
}
