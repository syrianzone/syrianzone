export const DATA_TYPES = {
  POPULATION: 'population',
  IDP: 'idp',
  IDP_RETURNEES: 'idp_returnees',
  RAINFALL: 'rainfall',
  ENVIRONMENTAL: 'environmental',
} as const;

export type DataType = (typeof DATA_TYPES)[keyof typeof DATA_TYPES];

export interface LegendItem {
  color: string;
  label: string;
  labelEn: string;
}

export interface DataTypeConfig {
  colors: {
    high: string;
    low: string;
    medium: string;
    none: string;
  };
  label: string;
  labelAr: string;
  labelEn: string;
  legend: readonly LegendItem[];
  thresholds: readonly [number, number, number];
}

export const DATA_TYPE_CONFIG: Readonly<Record<DataType, DataTypeConfig>> = {
  [DATA_TYPES.POPULATION]: {
    label: 'عدد السكان',
    labelAr: 'السكان',
    labelEn: 'Population',
    colors: { none: '#1e293b', low: '#3b82f6', medium: '#6366f1', high: '#8b5cf6' },
    thresholds: [100_000, 500_000, 1_000_000],
    legend: [
      { label: 'لا توجد بيانات', labelEn: 'No data', color: '#1e293b' },
      { label: 'أقل من ١٠٠ ألف', labelEn: 'Under 100 thousand', color: '#3b82f6' },
      { label: '١٠٠ ألف - ٥٠٠ ألف', labelEn: '100 to 500 thousand', color: '#6366f1' },
      { label: 'أكثر من مليون', labelEn: 'Over 1 million', color: '#8b5cf6' },
    ],
  },
  [DATA_TYPES.IDP]: {
    label: 'النازحين داخلياً',
    labelAr: 'النازحين',
    labelEn: 'Internally displaced',
    colors: { none: '#1e293b', low: '#f97316', medium: '#ea580c', high: '#ef4444' },
    thresholds: [100_000, 500_000, 1_000_000],
    legend: [
      { label: 'لا توجد بيانات', labelEn: 'No data', color: '#1e293b' },
      { label: 'أقل من ١٠٠ ألف', labelEn: 'Under 100 thousand', color: '#f97316' },
      { label: '١٠٠ ألف - ٥٠٠ ألف', labelEn: '100 to 500 thousand', color: '#ea580c' },
      { label: 'أكثر من ٥٠٠ ألف', labelEn: 'Over 500 thousand', color: '#ef4444' },
    ],
  },
  [DATA_TYPES.IDP_RETURNEES]: {
    label: 'العائدون من النزوح',
    labelAr: 'العائدون',
    labelEn: 'IDP returnees',
    colors: { none: '#1e293b', low: '#22c55e', medium: '#16a34a', high: '#4ade80' },
    thresholds: [50_000, 100_000, 200_000],
    legend: [
      { label: 'لا توجد بيانات', labelEn: 'No data', color: '#1e293b' },
      { label: 'أقل من ٥٠ ألف', labelEn: 'Under 50 thousand', color: '#22c55e' },
      { label: '٥٠ ألف - ١٠٠ ألف', labelEn: '50 to 100 thousand', color: '#16a34a' },
      { label: 'أكثر من ١٠٠ ألف', labelEn: 'Over 100 thousand', color: '#4ade80' },
    ],
  },
  [DATA_TYPES.RAINFALL]: {
    label: 'معدل الهطول المطري',
    labelAr: 'الأمطار',
    labelEn: 'Rainfall',
    colors: { none: '#1e293b', low: '#22d3ee', medium: '#0ea5e9', high: '#0284c7' },
    thresholds: [100, 300, 500],
    legend: [
      { label: 'لا توجد بيانات', labelEn: 'No data', color: '#1e293b' },
      { label: 'أقل من 100 مم', labelEn: 'Under 100 mm', color: '#22d3ee' },
      { label: '100 - 500 مم', labelEn: '100 to 500 mm', color: '#0ea5e9' },
      { label: 'أكثر من 500 مم', labelEn: 'Over 500 mm', color: '#0284c7' },
    ],
  },
  [DATA_TYPES.ENVIRONMENTAL]: {
    label: 'البيئة والمناخ',
    labelAr: 'الحرارة والمناخ',
    labelEn: 'Climate',
    colors: { none: '#1e293b', low: '#3b82f6', medium: '#22c55e', high: '#ef4444' },
    thresholds: [10, 20, 30],
    legend: [
      { label: 'بارد (< 10°)', labelEn: 'Cold (< 10°)', color: '#3b82f6' },
      { label: 'معتدل (10°-25°)', labelEn: 'Mild (10°-25°)', color: '#22c55e' },
      { label: 'دافئ (25°-30°)', labelEn: 'Warm (25°-30°)', color: '#eab308' },
      { label: 'حار (> 30°)', labelEn: 'Hot (> 30°)', color: '#ef4444' },
      { label: 'لا توجد بيانات', labelEn: 'No data', color: '#1e293b' },
    ],
  },
};

export const DATA_TYPE_ORDER = Object.values(DATA_TYPES);

/*
PORT STATUS
  source:     resources/js/Pages/Population/constants/data-config.ts (78 lines)
  confidence: high
  todos:      0
  notes:      Thresholds and colors stay exact, with English labels added for native locale switching.
*/
