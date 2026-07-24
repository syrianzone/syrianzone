import {
  Bus,
  CalendarDays,
  ChefHat,
  Clock3,
  CloudSun,
  ListTodo,
  MapPin,
  MessageCircleQuestion,
  Moon,
  Rss,
  StickyNote,
  Timer,
  Users,
} from 'lucide-react-native';

import type { WidgetDefinition } from './types';

const governorates = [
  ['damascus', 'دمشق', 'Damascus'],
  ['rural-damascus', 'ريف دمشق', 'Rural Damascus'],
  ['aleppo', 'حلب', 'Aleppo'],
  ['homs', 'حمص', 'Homs'],
  ['hama', 'حماة', 'Hama'],
  ['latakia', 'اللاذقية', 'Latakia'],
  ['tartus', 'طرطوس', 'Tartus'],
  ['deir-ez-zor', 'دير الزور', 'Deir ez-Zor'],
  ['idlib', 'إدلب', 'Idlib'],
  ['daraa', 'درعا', 'Daraa'],
  ['quneitra', 'القنيطرة', 'Quneitra'],
  ['sweida', 'السويداء', 'Sweida'],
  ['hasakah', 'الحسكة', 'Hasakah'],
  ['raqqa', 'الرقة', 'Raqqa'],
] as const;

export const GOVERNORATE_OPTIONS = governorates.map(
  ([value, labelAr, labelEn]) => ({ labelAr, labelEn, value }),
);

const definitions: readonly WidgetDefinition[] = [
  {
    category: 'time',
    defaultSize: { h: 2, w: 4 },
    descriptionAr: 'الوقت والتاريخ الحالي',
    descriptionEn: 'Current time and date',
    fields: [
      {
        default: '24',
        key: 'format',
        labelAr: 'صيغة الوقت',
        labelEn: 'Time format',
        options: [
          { labelAr: '24 ساعة', labelEn: '24 hour', value: '24' },
          { labelAr: '12 ساعة', labelEn: '12 hour', value: '12' },
        ],
        type: 'select',
      },
      {
        default: true,
        key: 'showDate',
        labelAr: 'إظهار التاريخ',
        labelEn: 'Show date',
        type: 'switch',
      },
    ],
    icon: Clock3,
    id: 'clock',
    maxSize: { h: 2, w: 12 },
    minSize: { h: 1, w: 2 },
    multiple: true,
    nameAr: 'الساعة',
    nameEn: 'Clock',
    refresh: { intervalMs: null, staleMs: 0 },
    requires: [],
  },
  {
    category: 'time',
    defaultSize: { h: 2, w: 4 },
    descriptionAr: 'درجة الحرارة والحالة الجوية',
    descriptionEn: 'Temperature and current conditions',
    fields: [
      {
        default: 'damascus',
        key: 'governorate',
        labelAr: 'المحافظة',
        labelEn: 'Governorate',
        options: GOVERNORATE_OPTIONS,
        type: 'select',
      },
    ],
    icon: CloudSun,
    id: 'weather',
    maxSize: { h: 2, w: 6 },
    minSize: { h: 1, w: 3 },
    multiple: true,
    nameAr: 'الطقس',
    nameEn: 'Weather',
    refresh: { intervalMs: 15 * 60_000, staleMs: 10 * 60_000 },
    requires: [],
  },
  {
    category: 'time',
    defaultSize: { h: 2, w: 4 },
    descriptionAr: 'الصلاة القادمة والوقت المتبقي',
    descriptionEn: 'Next prayer and time remaining',
    fields: [
      {
        default: 'damascus',
        key: 'governorate',
        labelAr: 'المحافظة',
        labelEn: 'Governorate',
        options: GOVERNORATE_OPTIONS,
        type: 'select',
      },
    ],
    icon: Moon,
    id: 'prayer',
    maxSize: { h: 4, w: 6 },
    minSize: { h: 1, w: 3 },
    multiple: false,
    nameAr: 'مواقيت الصلاة',
    nameEn: 'Prayer times',
    refresh: { intervalMs: null, staleMs: 6 * 60 * 60_000 },
    requires: [],
  },
  {
    category: 'places',
    defaultSize: { h: 3, w: 6 },
    descriptionAr: 'مشاوير قريبة من موقعك',
    descriptionEn: 'Places near your location',
    fields: [
      {
        default: 10,
        key: 'radius_km',
        labelAr: 'نطاق البحث (كم)',
        labelEn: 'Search radius (km)',
        max: 25,
        min: 1,
        type: 'number',
      },
    ],
    icon: MapPin,
    id: 'places-nearby',
    maxSize: { h: 6, w: 12 },
    minSize: { h: 2, w: 3 },
    multiple: false,
    nameAr: 'أماكن قريبة',
    nameEn: 'Nearby places',
    refresh: { intervalMs: null, staleMs: 5 * 60_000 },
    requires: ['geo'],
  },
  {
    category: 'community',
    defaultSize: { h: 3, w: 6 },
    descriptionAr: 'أكثر المساهمين في مشوار',
    descriptionEn: 'Top Mishwar contributors',
    fields: [
      {
        default: 'points',
        key: 'sort',
        labelAr: 'الترتيب',
        labelEn: 'Sort',
        options: [
          { labelAr: 'الأعلى نقاطاً', labelEn: 'Most points', value: 'points' },
          { labelAr: 'الأكثر مساهمة', labelEn: 'Most contributions', value: 'submissions' },
          { labelAr: 'الأكثر حفظاً', labelEn: 'Most saved', value: 'saves' },
          { labelAr: 'النشطون مؤخراً', labelEn: 'Recently active', value: 'recent' },
        ],
        type: 'select',
      },
    ],
    icon: Users,
    id: 'guides',
    maxSize: { h: 6, w: 12 },
    minSize: { h: 2, w: 3 },
    multiple: true,
    nameAr: 'المرشدون',
    nameEn: 'Guides',
    refresh: { intervalMs: null, staleMs: 5 * 60_000 },
    requires: [],
  },
  {
    category: 'community',
    defaultSize: { h: 3, w: 6 },
    descriptionAr: 'أحدث الأسئلة من إجابات سوريا',
    descriptionEn: 'Latest Syria Answers questions',
    fields: [
      {
        default: 8,
        key: 'limit',
        labelAr: 'عدد الأسئلة',
        labelEn: 'Question count',
        max: 20,
        min: 3,
        type: 'number',
      },
    ],
    icon: MessageCircleQuestion,
    id: 'answers',
    maxSize: { h: 6, w: 12 },
    minSize: { h: 2, w: 3 },
    multiple: false,
    nameAr: 'إجابات سوريا',
    nameEn: 'Syria Answers',
    refresh: { intervalMs: 10 * 60_000, staleMs: 5 * 60_000 },
    requires: [],
  },
  {
    category: 'community',
    defaultSize: { h: 3, w: 6 },
    descriptionAr: 'الفعاليات الجارية اليوم',
    descriptionEn: 'Events happening today',
    fields: [
      {
        default: 'damascus',
        key: 'governorate',
        labelAr: 'المحافظة',
        labelEn: 'Governorate',
        options: [
          ...GOVERNORATE_OPTIONS,
          { labelAr: 'كل سوريا', labelEn: 'All Syria', value: 'all' },
        ],
        type: 'select',
      },
    ],
    icon: CalendarDays,
    id: 'events-today',
    maxSize: { h: 6, w: 12 },
    minSize: { h: 2, w: 3 },
    multiple: true,
    nameAr: 'فعاليات اليوم',
    nameEn: 'Today events',
    refresh: { intervalMs: 15 * 60_000, staleMs: 10 * 60_000 },
    requires: [],
  },
  {
    category: 'community',
    defaultSize: { h: 3, w: 6 },
    descriptionAr: 'آخر العناوين من مصدر إخباري سوري',
    descriptionEn: 'Latest headlines from a Syrian source',
    fields: [
      {
        default: 'jard',
        key: 'source',
        labelAr: 'المصدر',
        labelEn: 'Source',
        options: [
          { labelAr: 'موجز أخبار سوريا', labelEn: 'Syria news brief', value: 'jard' },
          { labelAr: 'سانا', labelEn: 'SANA', value: 'sana' },
          { labelAr: 'حلب اليوم', labelEn: 'Halab Today', value: 'halab-today' },
          {
            labelAr: 'ذا سيريان أوبزرفر',
            labelEn: 'The Syrian Observer',
            value: 'syrian-observer',
          },
        ],
        type: 'select',
      },
    ],
    icon: Rss,
    id: 'rss',
    maxSize: { h: 6, w: 12 },
    minSize: { h: 2, w: 3 },
    multiple: true,
    nameAr: 'الأخبار',
    nameEn: 'News',
    refresh: { intervalMs: 15 * 60_000, staleMs: 10 * 60_000 },
    requires: [],
  },
  {
    category: 'transit',
    defaultSize: { h: 3, w: 6 },
    descriptionAr: 'المدن وعدد الخطوط المنشورة',
    descriptionEn: 'Cities and published route counts',
    fields: [],
    icon: Bus,
    id: 'transit-cities',
    maxSize: { h: 6, w: 12 },
    minSize: { h: 2, w: 3 },
    multiple: false,
    nameAr: 'المواصلات',
    nameEn: 'Transit',
    refresh: { intervalMs: null, staleMs: 30 * 60_000 },
    requires: [],
  },
  {
    category: 'food',
    defaultSize: { h: 3, w: 4 },
    descriptionAr: 'وصفة سورية مختارة كل يوم',
    descriptionEn: 'A Syrian recipe selected each day',
    fields: [],
    icon: ChefHat,
    id: 'recipe',
    maxSize: { h: 5, w: 6 },
    minSize: { h: 2, w: 3 },
    multiple: false,
    nameAr: 'وصفة اليوم',
    nameEn: 'Recipe of the day',
    refresh: { intervalMs: null, staleMs: 6 * 60 * 60_000 },
    requires: [],
  },
  {
    category: 'personal',
    defaultSize: { h: 4, w: 4 },
    descriptionAr: 'ملاحظات سريعة تبقى معك',
    descriptionEn: 'Quick notes that stay with you',
    fields: [],
    icon: StickyNote,
    id: 'notes',
    maxSize: { h: 6, w: 12 },
    minSize: { h: 2, w: 3 },
    multiple: true,
    nameAr: 'ملاحظات',
    nameEn: 'Notes',
    refresh: { intervalMs: null, staleMs: 0 },
    requires: [],
  },
  {
    category: 'personal',
    defaultSize: { h: 4, w: 4 },
    descriptionAr: 'قائمة مهام قصيرة تبقى معك',
    descriptionEn: 'A short task list that stays with you',
    fields: [
      {
        default: false,
        key: 'hideCompleted',
        labelAr: 'إخفاء المنجزة',
        labelEn: 'Hide completed',
        type: 'switch',
      },
    ],
    icon: ListTodo,
    id: 'todo',
    maxSize: { h: 8, w: 12 },
    minSize: { h: 2, w: 3 },
    multiple: true,
    nameAr: 'مهامي',
    nameEn: 'My tasks',
    refresh: { intervalMs: null, staleMs: 0 },
    requires: [],
  },
  {
    category: 'personal',
    defaultSize: { h: 3, w: 3 },
    descriptionAr: 'جلسات عمل وراحة بمؤقّت بسيط',
    descriptionEn: 'Simple work and rest sessions',
    fields: [
      {
        default: 25,
        key: 'work',
        labelAr: 'دقائق العمل',
        labelEn: 'Work minutes',
        max: 90,
        min: 5,
        type: 'number',
      },
      {
        default: 5,
        key: 'rest',
        labelAr: 'دقائق الراحة',
        labelEn: 'Rest minutes',
        max: 30,
        min: 1,
        type: 'number',
      },
    ],
    icon: Timer,
    id: 'pomodoro',
    maxSize: { h: 4, w: 6 },
    minSize: { h: 2, w: 2 },
    multiple: false,
    nameAr: 'مؤقّت بومودورو',
    nameEn: 'Pomodoro timer',
    refresh: { intervalMs: null, staleMs: 0 },
    requires: [],
  },
];

export const WIDGETS = definitions;

const widgetMap = new Map(WIDGETS.map((widget) => [widget.id, widget]));

export function findWidget(id: string): WidgetDefinition | undefined {
  return widgetMap.get(id);
}

/*
PORT STATUS
  source:     resources/js/Pages/Board/_lib/governorates.ts (25 lines)
  confidence: high
  todos:      0
  notes:      The native registry preserves the configured Syrian governorate options used by Board widgets.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Board/_lib/registry.ts (86 lines)
  confidence: high
  todos:      0
  notes:      The native registry preserves widget discovery, constraints, capabilities, configuration, and refresh metadata.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Board/_widgets/answers/index.ts (34 lines)
  confidence: high
  todos:      0
  notes:      The answers definition preserves identity, size constraints, labels, and refresh policy.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Board/_widgets/clock/index.ts (38 lines)
  confidence: high
  todos:      0
  notes:      The clock definition preserves identity, sizes, labels, timezone configuration, and refresh policy.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Board/_widgets/events-today/index.ts (38 lines)
  confidence: high
  todos:      0
  notes:      The events definition preserves identity, size constraints, labels, and refresh policy.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Board/_widgets/guides/index.ts (36 lines)
  confidence: high
  todos:      0
  notes:      The guides definition preserves identity, size constraints, labels, and refresh policy.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Board/_widgets/notes/index.ts (24 lines)
  confidence: high
  todos:      0
  notes:      The notes definition preserves identity, size constraints, labels, multiplicity, and local behavior.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Board/_widgets/places-nearby/index.ts (26 lines)
  confidence: high
  todos:      0
  notes:      The nearby places definition preserves identity, sizes, labels, location capability, and refresh policy.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Board/_widgets/pomodoro/index.ts (31 lines)
  confidence: high
  todos:      0
  notes:      The Pomodoro definition preserves identity, sizes, labels, multiplicity, and local behavior.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Board/_widgets/prayer/index.ts (27 lines)
  confidence: high
  todos:      0
  notes:      The prayer definition preserves identity, sizes, labels, governorate configuration, and refresh policy.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Board/_widgets/recipe/index.ts (20 lines)
  confidence: high
  todos:      0
  notes:      The recipe definition preserves identity, size constraints, labels, and refresh policy.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Board/_widgets/rss/index.ts (42 lines)
  confidence: high
  todos:      0
  notes:      The RSS definition preserves identity, sizes, labels, feed configuration, and refresh policy.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Board/_widgets/todo/index.ts (36 lines)
  confidence: high
  todos:      0
  notes:      The todo definition preserves identity, sizes, labels, multiplicity, and local behavior.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Board/_widgets/transit-cities/index.ts (20 lines)
  confidence: high
  todos:      0
  notes:      The transit definition preserves identity, size constraints, labels, and refresh policy.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Board/_widgets/weather/index.ts (26 lines)
  confidence: high
  todos:      0
  notes:      The weather definition preserves identity, sizes, labels, governorate configuration, and refresh policy.
*/
