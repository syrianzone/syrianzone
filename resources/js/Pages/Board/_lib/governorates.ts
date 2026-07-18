// Same coordinates Home.tsx uses. Duplicated rather than imported: Home is a
// large page chunk and the board should not pull it in to read a lookup table.
export const GOVERNORATES: Record<string, { lat: number; lon: number; label: string }> = {
  'damascus': { lat: 33.5138, lon: 36.2765, label: 'دمشق' },
  'rural-damascus': { lat: 33.5138, lon: 36.2765, label: 'ريف دمشق' },
  'aleppo': { lat: 36.2021, lon: 37.1343, label: 'حلب' },
  'homs': { lat: 34.7324, lon: 36.7137, label: 'حمص' },
  'hama': { lat: 35.1318, lon: 36.7578, label: 'حماة' },
  'latakia': { lat: 35.5317, lon: 35.7901, label: 'اللاذقية' },
  'tartus': { lat: 34.8890, lon: 35.8866, label: 'طرطوس' },
  'deir-ez-zor': { lat: 35.3359, lon: 40.1408, label: 'دير الزور' },
  'idlib': { lat: 35.9306, lon: 36.6339, label: 'إدلب' },
  'daraa': { lat: 32.6255, lon: 36.1016, label: 'درعا' },
  'quneitra': { lat: 33.1250, lon: 35.8250, label: 'القنيطرة' },
  'sweida': { lat: 32.7089, lon: 36.5695, label: 'السويداء' },
  'hasakah': { lat: 36.5023, lon: 40.7382, label: 'الحسكة' },
  'raqqa': { lat: 35.9520, lon: 39.0081, label: 'الرقة' },
};

export const GOVERNORATE_OPTIONS = Object.entries(GOVERNORATES).map(([value, g]) => ({ value, label: g.label }));

export function coordsOf(governorate: string): { lat: number; lon: number } {
  const g = GOVERNORATES[governorate] ?? GOVERNORATES['damascus'];
  return { lat: g.lat, lon: g.lon };
}
