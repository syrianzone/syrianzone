class TextUtil {
  static String toArabicDigits(Object value) {
    const westernDigits = '0123456789';
    const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
    return value.toString().split('').map((char) {
      final index = westernDigits.indexOf(char);
      return index == -1 ? char : arabicDigits[index];
    }).join();
  }
}