// Shared governorate table for the Muslim section + prayer widgets.
// Same coordinates as Home.tsx, Board/_lib/governorates.ts and
// Roznama/Index.tsx. Duplicated (not imported from Home) so the board and
// /muslim chunks never pull in a full page bundle for a lookup table.
export interface GovernorateEntry {
  lat: number;
  lon: number;
  label: string;
  labelEn: string;
}

export const MUSLIM_GOVERNORATES: Record<string, GovernorateEntry> = {
  damascus: { lat: 33.5138, lon: 36.2765, label: 'دمشق', labelEn: 'Damascus' },
  'rural-damascus': { lat: 33.5138, lon: 36.2765, label: 'ريف دمشق', labelEn: 'Rural Damascus' },
  aleppo: { lat: 36.2021, lon: 37.1343, label: 'حلب', labelEn: 'Aleppo' },
  homs: { lat: 34.7324, lon: 36.7137, label: 'حمص', labelEn: 'Homs' },
  hama: { lat: 35.1318, lon: 36.7578, label: 'حماة', labelEn: 'Hama' },
  latakia: { lat: 35.5317, lon: 35.7901, label: 'اللاذقية', labelEn: 'Latakia' },
  tartus: { lat: 34.889, lon: 35.8866, label: 'طرطوس', labelEn: 'Tartus' },
  'deir-ez-zor': { lat: 35.3359, lon: 40.1408, label: 'دير الزور', labelEn: 'Deir ez-Zor' },
  idlib: { lat: 35.9306, lon: 36.6339, label: 'إدلب', labelEn: 'Idlib' },
  daraa: { lat: 32.6255, lon: 36.1016, label: 'درعا', labelEn: 'Daraa' },
  quneitra: { lat: 33.125, lon: 35.825, label: 'القنيطرة', labelEn: 'Quneitra' },
  sweida: { lat: 32.7089, lon: 36.5695, label: 'السويداء', labelEn: 'Sweida' },
  hasakah: { lat: 36.5023, lon: 40.7382, label: 'الحسكة', labelEn: 'Hasakah' },
  raqqa: { lat: 35.952, lon: 39.0081, label: 'الرقة', labelEn: 'Raqqa' },
};

export const MUSLIM_GOVERNORATE_OPTIONS = Object.entries(MUSLIM_GOVERNORATES).map(
  ([value, g]) => ({ value, label: g.label }),
);
