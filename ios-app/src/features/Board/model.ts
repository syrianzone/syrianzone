import governorateRows from '../../../../resources/data/governorates.json';

export interface WidgetInstance { i: string; d: string; w: number; h: number; c: Record<string, unknown> }
export interface Dashboard { id: string; name: string; widgets: WidgetInstance[] }
export interface BoardDoc { v: 1; activeId: string; updatedAt: string; dashboards: Dashboard[] }
export interface ConfigField { key: string; label: string; type: 'number' | 'switch' | 'select'; default: string | number | boolean; min?: number; max?: number; options?: readonly { value: string; label: string }[] }
export interface WidgetDefinition {
  id: string; name: string; category: 'time' | 'personal' | 'community' | 'places' | 'food';
  defaultSize: [number, number]; min: [number, number]; max: [number, number]; multiple: boolean;
  seed: { order: number; w: number; h: number } | null; fields: ConfigField[];
}
const cities = governorateRows.slice().sort((a, b) => a.picker_order - b.picker_order).map(city => ({ value: city.id, label: city.name_ar }));
const cityField: ConfigField = { key: 'governorate', label: 'المحافظة', type: 'select', default: 'damascus', options: cities };
function declaration(id: string, name: string, category: WidgetDefinition['category'], size: [number, number], min: [number, number], max: [number, number], multiple: boolean, order: number | null, fields: ConfigField[] = [], seedSize = size): WidgetDefinition {
  return { id, name, category, defaultSize: size, min, max, multiple, fields, seed: order === null ? null : { order, w: seedSize[0], h: seedSize[1] } };
}
export const widgets: readonly WidgetDefinition[] = [
  declaration('weather', 'الطقس', 'time', [4, 2], [3, 1], [6, 2], true, 1, [cityField]),
  declaration('prayer', 'مواقيت الصلاة', 'time', [4, 2], [3, 1], [6, 4], false, 2, [
    { ...cityField, default: 'auto', options: [{ value: 'auto', label: 'حسب موقعي' }, ...cities] },
    { key: 'method', label: 'طريقة الحساب', type: 'select', default: '3', options: [
      { value: '3', label: 'رابطة العالم الإسلامي (سوريا)' }, { value: '5', label: 'الهيئة المصرية للمساحة' },
      { value: '4', label: 'جامعة أم القرى (مكة)' }, { value: '1', label: 'كراتشي' }, { value: '2', label: 'أمريكا الشمالية (ISNA)' }
    ] }
  ]),
  declaration('clock', 'الساعة', 'time', [4, 2], [2, 1], [12, 2], true, 3, [
    { key: 'format', label: 'صيغة الوقت', type: 'select', default: '24', options: [{ value: '24', label: '24 ساعة' }, { value: '12', label: '12 ساعة' }] },
    { key: 'showDate', label: 'إظهار التاريخ', type: 'switch', default: true }
  ]),
  declaration('quran', 'إذاعة القرآن الكريم', 'time', [4, 2], [3, 2], [6, 3], true, 4),
  declaration('pomodoro', 'مؤقّت بومودورو', 'personal', [4, 2], [3, 2], [6, 4], false, 5, [
    { key: 'work', label: 'دقائق العمل', type: 'number', default: 25, min: 5, max: 90 },
    { key: 'rest', label: 'دقائق الراحة', type: 'number', default: 5, min: 1, max: 30 }
  ]),
  declaration('recipe', 'وصفة اليوم', 'food', [4, 3], [3, 2], [6, 5], false, 6),
  declaration('rss', 'الأخبار', 'community', [6, 3], [3, 2], [12, 6], true, 7, [
    { key: 'source', label: 'المصدر', type: 'select', default: 'jard', options: [
      { value: 'jard', label: 'موجز أخبار سوريا' }, { value: 'sana', label: 'سانا' },
      { value: 'halab-today', label: 'حلب اليوم' }, { value: 'syrian-observer', label: 'ذا سيريان أوبزرفر' }
    ] }
  ]),
  declaration('answers', 'إجابات سوريا', 'community', [6, 3], [3, 2], [12, 6], false, 8, [{ key: 'limit', label: 'عدد الأسئلة', type: 'number', default: 8, min: 3, max: 20 }]),
  declaration('notes', 'ملاحظات', 'personal', [6, 3], [3, 2], [12, 6], true, 9),
  declaration('todo', 'مهامي', 'personal', [4, 4], [3, 2], [12, 8], true, 10, [{ key: 'hideCompleted', label: 'إخفاء المنجزة', type: 'switch', default: false }], [6, 3]),
  declaration('events-today', 'فعاليات اليوم', 'community', [6, 3], [3, 2], [12, 6], true, null, [{ ...cityField, options: [...cities, { value: 'all', label: 'كل سوريا' }] }]),
  declaration('guides', 'المرشدون', 'community', [6, 3], [3, 2], [12, 6], true, null, [{ key: 'sort', label: 'الترتيب', type: 'select', default: 'submissions', options: [{ value: 'submissions', label: 'الأكثر مساهمة' }, { value: 'saves', label: 'الأكثر حفظاً' }, { value: 'recent', label: 'النشطون مؤخراً' }] }]),
  declaration('places-nearby', 'أماكن قريبة', 'places', [6, 3], [3, 2], [12, 6], false, null, [{ key: 'radius_km', label: 'نطاق البحث (كم)', type: 'number', default: 10, min: 1, max: 25 }]),
  declaration('transit-cities', 'المواصلات', 'places', [6, 3], [3, 2], [12, 6], false, null)
];
export const categories = [{ id: 'time', label: 'الوقت والعبادات' }, { id: 'personal', label: 'الإنتاجية والشخصي' }, { id: 'community', label: 'المجتمع والأخبار' }, { id: 'places', label: 'الأماكن والمواصلات' }, { id: 'food', label: 'المطبخ والمأكولات' }] as const;
let sequence = 0;
function newId(prefix: string): string { return `${prefix}_${Date.now().toString(36)}_${(++sequence).toString(36)}_${Math.random().toString(36).slice(2, 7)}`; }
export function definition(key: string): WidgetDefinition | undefined { return widgets.find(widget => widget.id === key); }
export function clampSize(w: number, h: number, declared?: WidgetDefinition): { w: number; h: number } {
  return { w: Math.max(declared?.min[0] ?? 1, Math.min(declared?.max[0] ?? 12, Math.round(w))),
    h: Math.max(declared?.min[1] ?? 1, Math.min(declared?.max[1] ?? 8, Math.round(h))) };
}
export function defaultDocument(): BoardDoc {
  return { v: 1, activeId: 'd_main', updatedAt: new Date().toISOString(), dashboards: [{ id: 'd_main', name: 'الرئيسية', widgets: widgets
    .filter(widget => widget.seed !== null).sort((a, b) => (a.seed?.order ?? 0) - (b.seed?.order ?? 0))
    .map(widget => ({ i: newId('w'), d: widget.id, ...clampSize(widget.seed?.w ?? widget.defaultSize[0], widget.seed?.h ?? widget.defaultSize[1], widget),
      c: Object.fromEntries(widget.fields.map(field => [field.key, field.default])) })) }] };
}
function object(value: unknown): Record<string, unknown> | null { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function identifier(value: unknown): value is string { return typeof value === 'string' && value.length > 0 && value.length <= 40; }
function decodeWidget(value: unknown): WidgetInstance | null {
  const row = object(value);
  if (!row || !identifier(row.i) || !identifier(row.d) || typeof row.w !== 'number' || !Number.isInteger(row.w) || row.w < 1 || row.w > 12
    || typeof row.h !== 'number' || !Number.isInteger(row.h) || row.h < 1 || row.h > 8) return null;
  return { i: row.i, d: row.d, w: row.w, h: row.h, c: object(row.c) ?? {} };
}
export function migrate(value: unknown): BoardDoc {
  const row = object(value);
  if (!row || row.v !== 1 || typeof row.activeId !== 'string' || typeof row.updatedAt !== 'string' || !Array.isArray(row.dashboards) || !row.dashboards.length) return defaultDocument();
  const dashboards: Dashboard[] = [];
  for (const rawDashboard of row.dashboards.slice(0, 10)) {
    const dashboard = object(rawDashboard);
    if (!dashboard || !identifier(dashboard.id) || !identifier(dashboard.name) || !Array.isArray(dashboard.widgets)) return defaultDocument();
    dashboards.push({ id: dashboard.id, name: dashboard.name, widgets: dashboard.widgets.map(decodeWidget).filter((widget): widget is WidgetInstance => widget !== null).slice(0, 40) });
  }
  const first = dashboards[0];
  if (!first) return defaultDocument();
  return { v: 1, activeId: dashboards.some(dashboard => dashboard.id === row.activeId) ? row.activeId : first.id, updatedAt: row.updatedAt, dashboards };
}
export function activeDashboard(document: BoardDoc): Dashboard {
  const dashboard = document.dashboards.find(item => item.id === document.activeId) ?? document.dashboards[0];
  if (!dashboard) throw new Error('اللوحة غير صالحة.');
  return dashboard;
}
function change(document: BoardDoc, update: (dashboard: Dashboard) => Dashboard): BoardDoc {
  return { ...document, updatedAt: new Date().toISOString(), dashboards: document.dashboards.map(dashboard => dashboard.id === document.activeId ? update(dashboard) : dashboard) };
}
export function addWidget(document: BoardDoc, key: string): BoardDoc {
  const declared = definition(key), active = activeDashboard(document);
  if (!declared || active.widgets.length >= 40 || (!declared.multiple && active.widgets.some(widget => widget.d === key))) return document;
  const widget = { i: newId('w'), d: key, ...clampSize(...declared.defaultSize, declared), c: Object.fromEntries(declared.fields.map(field => [field.key, field.default])) };
  return change(document, dashboard => ({ ...dashboard, widgets: [...dashboard.widgets, widget] }));
}
export function removeWidget(document: BoardDoc, key: string): BoardDoc { return change(document, dashboard => ({ ...dashboard, widgets: dashboard.widgets.filter(widget => widget.i !== key) })); }
export function resizeWidget(document: BoardDoc, key: string, w: number, h: number): BoardDoc {
  return change(document, dashboard => ({ ...dashboard, widgets: dashboard.widgets.map(widget => widget.i === key ? { ...widget, ...clampSize(w, h, definition(widget.d)) } : widget) }));
}
export function updateWidgetConfig(document: BoardDoc, key: string, patch: Record<string, unknown>): BoardDoc {
  return change(document, dashboard => ({ ...dashboard, widgets: dashboard.widgets.map(widget => widget.i === key ? { ...widget, c: { ...widget.c, ...patch } } : widget) }));
}
export function moveWidget(document: BoardDoc, from: string, to: string): BoardDoc {
  return change(document, dashboard => {
    const list = dashboard.widgets.slice(), a = list.findIndex(widget => widget.i === from), b = list.findIndex(widget => widget.i === to);
    if (a < 0 || b < 0 || a === b) return dashboard;
    const [item] = list.splice(a, 1);
    if (item) list.splice(b, 0, item);
    return { ...dashboard, widgets: list };
  });
}
export function addDashboard(document: BoardDoc, name: string): BoardDoc {
  if (document.dashboards.length >= 10) return document;
  const dashboard = { id: newId('d'), name: name.trim().slice(0, 40) || 'لوحة جديدة', widgets: [] };
  return { ...document, activeId: dashboard.id, updatedAt: new Date().toISOString(), dashboards: [...document.dashboards, dashboard] };
}
export function selectDashboard(document: BoardDoc, key: string): BoardDoc { return document.dashboards.some(dashboard => dashboard.id === key) ? { ...document, activeId: key, updatedAt: new Date().toISOString() } : document; }
export function renameDashboard(document: BoardDoc, key: string, name: string): BoardDoc {
  const clean = name.trim().slice(0, 40);
  return clean ? { ...document, updatedAt: new Date().toISOString(), dashboards: document.dashboards.map(dashboard => dashboard.id === key ? { ...dashboard, name: clean } : dashboard) } : document;
}
export function removeDashboard(document: BoardDoc, key: string): BoardDoc {
  if (document.dashboards.length <= 1) return document;
  const dashboards = document.dashboards.filter(dashboard => dashboard.id !== key);
  const first = dashboards[0];
  return first ? { ...document, dashboards, activeId: dashboards.some(dashboard => dashboard.id === document.activeId) ? document.activeId : first.id, updatedAt: new Date().toISOString() } : document;
}
export function packWidgets(list: readonly WidgetInstance[], columns: number): { widget: WidgetInstance; x: number; y: number; w: number; h: number }[] {
  const cols = Math.max(1, Math.min(12, Math.floor(columns))), occupied = new Set<number>();
  return list.map(widget => {
    const w = Math.min(widget.w, cols), h = widget.h;
    let y = 0, x = 0;
    for (;;) {
      let free = x + w <= cols;
      for (let dy = 0; free && dy < h; dy++) for (let dx = 0; dx < w; dx++) if (occupied.has((y + dy) * cols + x + dx)) { free = false; break; }
      if (free) break;
      if (++x >= cols) { x = 0; y++; }
    }
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) occupied.add((y + dy) * cols + x + dx);
    return { widget, x, y, w, h };
  });
}

// PORT STATUS: source resources/js/Pages/Board/_lib/layout.ts; confidence high; todos 0.
