abstract class MishwarConstants {
  /// Guide sorting options available in the Guides tab
  static const List<Map<String, String>> guideSorts = [
    {'key': 'points', 'label': 'الأعلى نقاطاً'},
    {'key': 'submissions', 'label': 'الأكثر مساهمة'},
    {'key': 'saves', 'label': 'الأكثر حفظاً'},
    {'key': 'recent', 'label': 'النشطون مؤخراً'},
  ];

  /// Base place categories (Single Source of Truth)
  static const List<Map<String, String>> placeCategories = [
    {'key': 'historical', 'label': 'تاريخي'},
    {'key': 'natural', 'label': 'طبيعي'},
    {'key': 'cultural', 'label': 'ثقافي'},
    {'key': 'religious', 'label': 'ديني'},
    {'key': 'abandoned', 'label': 'مهجور'},
    {'key': 'viewpoint', 'label': 'إطلالة'},
    {'key': 'market', 'label': 'سوق'},
    {'key': 'food', 'label': 'مأكولات'},
    {'key': 'other', 'label': 'آخر'},
  ];

  /// Filter categories derived from [placeCategories] with 'الكل' prepended
  static const List<Map<String, String?>> filterCategories = [
    {'key': null, 'label': 'الكل'},
    ...placeCategories,
  ];

  /// Fast lookup map automatically generated from [placeCategories]
  static final Map<String, String> categoryLabels = {
    for (final cat in placeCategories) cat['key']!: cat['label']!,
  };

  /// Returns the Arabic label for a given category key.
  /// If [categoryKey] is null or empty, returns 'الكل'.
  /// If unknown, falls back to the key itself.
  static String getCategoryLabel(String? categoryKey) {
    if (categoryKey == null || categoryKey.isEmpty) return 'الكل';
    return categoryLabels[categoryKey] ?? categoryKey;
  }

  /// Guide rank titles by level (1 to 10)
  static const Map<int, String> rankNames = {
    1: 'مبتدئ',
    2: 'جوّال',
    3: 'مستطلع',
    4: 'مستكشف',
    5: 'مرشد محلي',
    6: 'مرشد خبير',
    7: 'رحّالة',
    8: 'رائد السياحة',
    9: 'سفير السياحة',
    10: 'وزير السياحة',
  };

  /// Points threshold required to reach each guide level
  static const Map<int, int> levelThresholds = {
    1: 0,
    2: 15,
    3: 75,
    4: 250,
    5: 500,
    6: 1500,
    7: 5000,
    8: 15000,
    9: 50000,
    10: 100000,
  };

  /// Returns the rank title for a given guide level.
  static String getRankName(int level) {
    final clamped = level.clamp(1, 10);
    return rankNames[clamped] ?? 'مرشد';
  }
}
