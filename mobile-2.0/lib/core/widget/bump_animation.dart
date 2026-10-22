
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

class BumpyBusAnimation extends StatefulWidget {
  const BumpyBusAnimation({super.key});

  @override
  State<BumpyBusAnimation> createState() =>
      _BumpyBusAnimationState();
}

class _BumpyBusAnimationState extends State<BumpyBusAnimation>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _horizontal;
  late final Animation<double> _vertical;
  late final Animation<double> _rotation;

  @override
  void initState() {
    super.initState();

    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    );

    // 1. Drive forward.
    // 2. Hit the bump and launch.
    // 3. Fall and bounce on landing.
    _horizontal = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween(begin: 0.0, end: 10.0)
            .chain(CurveTween(curve: Curves.easeOut)),
        weight: 25,
      ),
      TweenSequenceItem(
        tween: Tween(begin: 10.0, end: 14.0)
            .chain(CurveTween(curve: Curves.easeIn)),
        weight: 10,
      ),
      TweenSequenceItem(
        tween: Tween(begin: 14.0, end: -6.0)
            .chain(CurveTween(curve: Curves.easeOut)),
        weight: 20,
      ),
      TweenSequenceItem(
        tween: Tween(begin: -6.0, end: 0.0)
            .chain(CurveTween(curve: Curves.easeInOut)),
        weight: 15,
      ),
      TweenSequenceItem(
        tween: Tween(begin: 0.0, end: 0.0),
        weight: 30,
      ),
    ]).animate(_controller);

    _vertical = TweenSequence<double>([
      // Drive normally.
      TweenSequenceItem(
        tween: Tween(begin: 0.0, end: 0.0),
        weight: 25,
      ),

      // Hit the bump.
      TweenSequenceItem(
        tween: Tween(begin: 0.0, end: 8.0)
            .chain(CurveTween(curve: Curves.easeIn)),
        weight: 5,
      ),

      // Fly upward.
      TweenSequenceItem(
        tween: Tween(begin: 8.0, end: -48.0)
            .chain(CurveTween(curve: Curves.easeOut)),
        weight: 15,
      ),

      // Fall back down.
      TweenSequenceItem(
        tween: Tween(begin: -48.0, end: 0.0)
            .chain(CurveTween(curve: Curves.easeIn)),
        weight: 15,
      ),

      // Bounce after landing.
      TweenSequenceItem(
        tween: Tween(begin: 0.0, end: -10.0)
            .chain(CurveTween(curve: Curves.easeOut)),
        weight: 10,
      ),
      TweenSequenceItem(
        tween: Tween(begin: -10.0, end: 0.0)
            .chain(CurveTween(curve: Curves.bounceOut)),
        weight: 30,
      ),
    ]).animate(_controller);

    _rotation = TweenSequence<double>([
      // Normal driving.
      TweenSequenceItem(
        tween: Tween(begin: 0.0, end: 0.0),
        weight: 25,
      ),

      // Front lifts when hitting the bump.
      TweenSequenceItem(
        tween: Tween(begin: 0.0, end: -0.12)
            .chain(CurveTween(curve: Curves.easeOut)),
        weight: 10,
      ),

      // Tilt backward in the air.
      TweenSequenceItem(
        tween: Tween(begin: -0.12, end: -0.08),
        weight: 10,
      ),

      // Tilt forward on landing.
      TweenSequenceItem(
        tween: Tween(begin: -0.08, end: 0.07)
            .chain(CurveTween(curve: Curves.easeIn)),
        weight: 15,
      ),

      // Suspension settles.
      TweenSequenceItem(
        tween: Tween(begin: 0.07, end: -0.025),
        weight: 15,
      ),
      TweenSequenceItem(
        tween: Tween(begin: -0.025, end: 0.0)
            .chain(CurveTween(curve: Curves.easeOut)),
        weight: 25,
      ),
    ]).animate(_controller);

    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      child: SvgPicture.asset(
        'assets/images/ic_transit.svg',
        width: 50,
      ),
      builder: (context, child) {
        return Transform.translate(
          offset: Offset(
            _horizontal.value,
            _vertical.value,
          ),
          child: Transform.rotate(
            angle: _rotation.value,
            alignment: Alignment.center,
            child: child,
          ),
        );
      },
    );
  }
}