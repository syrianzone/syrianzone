class RoutePalette {
  static const colors = [
    '#e8a838', // saffron gold
    '#c44b4b', // pomegranate red
    '#4a8fa8', // Damascene tile blue
    '#7ab87a', // olive green
    '#d4956a', // terracotta / apricot
    '#9b6bb5', // Byzantine purple
    '#5ba08a', // copper dome patina
    '#c9784a', // burnt sienna
  ];

  static String colorForIndexOrDefault(int index) {
    if (index < colors.length && index >= 0) {
      return colors[index];
    }
    return colors[0];
  }
}
