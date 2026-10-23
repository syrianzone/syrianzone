import 'package:flutter/material.dart';

extension NavigationExtensions on BuildContext {
  void pop() {
    Navigator.of(this).pop();
  }

  void pushNamed(String routeName, {Object? arguments}) {
    Navigator.of(this).pushNamed(routeName, arguments: arguments);
  }

  void pushReplacementNamed(String routeName, {Object? arguments}) {
    Navigator.of(this).pushReplacementNamed(routeName, arguments: arguments);
  }

  bool canPop() {
    return Navigator.of(this).canPop();
  }
}
