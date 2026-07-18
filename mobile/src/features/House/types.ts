export type Mode = 'voters' | 'candidates' | 'winners' | 'presidential';

export interface HouseRow {
  Age: string;
  __ageGroup: string;
  __appealStatus: string;
  __nameNorm: string;
  __placeNorm: string;
  __sexNorm: string;
  [key: string]: string;
}

export interface HouseData {
  headers: string[];
  rows: HouseRow[];
}

export const HOUSE_MODES: readonly { id: Mode; label: string }[] = [
  { id: 'voters', label: 'الهيئات الناخبة' },
  { id: 'candidates', label: 'المرشحون' },
  { id: 'winners', label: 'الفائزون' },
  { id: 'presidential', label: 'الثلث الرئاسي' },
];

export const PROVINCES = [
  { key: 'all', label: 'الكل' },
  { key: 'qunaitra', label: 'القنيطرة' },
  { key: 'idlib', label: 'إدلب' },
  { key: 'hama', label: 'حماة' },
  { key: 'damascus', label: 'دمشق' },
  { key: 'rif-damascus', label: 'ريف دمشق' },
  { key: 'daraa', label: 'درعا' },
  { key: 'latakia', label: 'اللاذقية' },
  { key: 'tartus', label: 'طرطوس' },
  { key: 'homs', label: 'حمص' },
  { key: 'aleppo', label: 'حلب' },
  { key: 'deir-ez-zor', label: 'دير الزور' },
  { key: 'raqqa', label: 'الرقة' },
  { key: 'hasakah', label: 'الحسكة' },
] as const;

export type ProvinceKey = (typeof PROVINCES)[number]['key'];

/*
PORT STATUS
  source:     resources/js/Pages/House/types.ts (36 lines)
  confidence: high
  todos:      0
  notes:      Native mode and province contracts omit server-only sheet coordinates.
*/
