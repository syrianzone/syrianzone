import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Modal, PanResponder, ScrollView, View, type GestureResponderEvent, type PanResponderGestureState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdaptivePanes, contentStyle, FormField, Heading, Label, Section } from '../../components';
import { NativeAction, NativeIconAction, NativePicker, NativeSlider, NativeSymbol, NativeToggle } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { activeDashboard, addDashboard, addWidget, categories, definition, moveWidget, packWidgets, removeDashboard, removeWidget, renameDashboard, resizeWidget, selectDashboard, updateWidgetConfig, widgets, type BoardDoc, type WidgetInstance } from './model';
import { useBoardDocument } from './state';
import { WidgetView } from './widgets';

interface DragCallbacks { begin(id: string): void; move(id: string, x: number, y: number): void; end(id: string): void; cancel(): void }
function DragHeader({ widget, callbacks, previous, next }: { widget: WidgetInstance; callbacks: DragCallbacks; previous(): void; next(): void }): React.JSX.Element {
  const latest = useRef(callbacks); latest.current = callbacks;
  const [pan] = useState(() => PanResponder.create({ onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_event: GestureResponderEvent, gesture: PanResponderGestureState) => Math.abs(gesture.dx) + Math.abs(gesture.dy) >= 8,
    onPanResponderGrant: () => latest.current.begin(widget.i), onPanResponderMove: (_event, gesture) => latest.current.move(widget.i, gesture.moveX, gesture.moveY),
    onPanResponderRelease: () => latest.current.end(widget.i), onPanResponderTerminate: () => latest.current.cancel(), onPanResponderTerminationRequest: () => false }));
  return <View {...pan.panHandlers} accessible accessibilityRole="adjustable" accessibilityLabel={`ترتيب ${definition(widget.d)?.name ?? widget.d}`}
    accessibilityHint="اسحب العنوان لتغيير ترتيب الويدجت" accessibilityActions={[{ name: 'increment', label: 'نقل إلى التالي' }, { name: 'decrement', label: 'نقل إلى السابق' }]}
    onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'increment') next(); else if (event.nativeEvent.actionName === 'decrement') previous(); }}
    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, flex: 1 }}><NativeSymbol name="line.3.horizontal" /><Label style={{ flex: 1, fontWeight: '700' }}>{definition(widget.d)?.name ?? widget.d}</Label></View>;
}
export function BoardScreen(): React.JSX.Element {
  const board = useBoardDocument(), { colors } = useTheme(), [editing, setEditing] = useState(false), [sheet, setSheet] = useState<'gallery' | 'dashboards' | 'config' | null>(null), [category, setCategory] = useState('all');
  const [configured, setConfigured] = useState<string | null>(null), [name, setName] = useState(''), [bounds, setBounds] = useState({ width: 0, height: 0 }), [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null), overRef = useRef<string | null>(null), dragRef = useRef<string | null>(null);
  const grid = useRef<React.ComponentRef<typeof View>>(null), scroll = useRef<React.ComponentRef<typeof ScrollView>>(null), scrollOffset = useRef(0), gridOrigin = useRef({ x: 0, y: 0 }), scrollBounds = useRef({ top: 0, bottom: 0 });
  const [translation] = useState(() => new Animated.ValueXY()), originPoint = useRef<{ x: number; y: number } | null>(null), lastPoint = useRef<{ x: number; y: number } | null>(null), autoScroll = useRef<ReturnType<typeof setInterval> | null>(null);
  const contentHeight = useRef(0);
  const dashboard = activeDashboard(board.document), gridWidth = Math.max(0, bounds.width - 36), columns = bounds.width >= 1024 ? 12 : bounds.width >= 768 ? 6 : 2, gap = 12, cell = Math.max(0, (gridWidth - gap * (columns - 1)) / columns);
  const packed = useMemo(() => packWidgets(dashboard.widgets, columns), [dashboard.widgets, columns]);
  const configuredWidget = dashboard.widgets.find(widget => widget.i === configured), configuredDefinition = configuredWidget ? definition(configuredWidget.d) : undefined;
  const commit = (operation: (document: BoardDoc) => BoardDoc): void => { void board.change(operation).catch(() => undefined); };
  function finish(): void { if (autoScroll.current) clearInterval(autoScroll.current); autoScroll.current = null; dragRef.current = null; setDragging(null); setOver(null); overRef.current = null; originPoint.current = null; lastPoint.current = null; translation.setValue({ x: 0, y: 0 }); }
  useEffect(() => () => { if (autoScroll.current) clearInterval(autoScroll.current); }, []);
  function chooseTarget(x: number, y: number): void {
    const localX = x - gridOrigin.current.x, localY = y - gridOrigin.current.y;
    let target: string | null = null, distance = Infinity;
    for (const item of packed) {
      const centerX = gridWidth - item.x * (cell + gap) - (item.w * cell + (item.w - 1) * gap) / 2, centerY = item.y * 88 + (item.h * 76 + (item.h - 1) * 12) / 2;
      const delta = (centerX - localX) ** 2 + (centerY - localY) ** 2;
      if (delta < distance) { target = item.widget.i; distance = delta; }
    }
    if (target !== overRef.current) { overRef.current = target; setOver(target); }
  }
  const callbacks: DragCallbacks = {
    begin(id) {
      dragRef.current = id; setDragging(id); originPoint.current = null;
      grid.current?.measureInWindow((x, y) => { gridOrigin.current = { x, y }; });
      scroll.current?.measureInWindow((_x, y, _width, height) => { scrollBounds.current = { top: y, bottom: y + height }; });
      autoScroll.current = setInterval(() => {
        const point = lastPoint.current; if (!point || !dragRef.current) return;
        const delta = point.y < scrollBounds.current.top + 60 ? -12 : point.y > scrollBounds.current.bottom - 60 ? 12 : 0;
        if (!delta) return;
        const next = Math.max(0, Math.min(Math.max(0, contentHeight.current - (scrollBounds.current.bottom - scrollBounds.current.top)), scrollOffset.current + delta)), actual = next - scrollOffset.current; scrollOffset.current = next; gridOrigin.current.y -= actual;
        scroll.current?.scrollTo({ y: next, animated: false }); chooseTarget(point.x, point.y);
      }, 30);
    },
    move(_id, x, y) { if (!originPoint.current) originPoint.current = { x, y }; lastPoint.current = { x, y }; translation.setValue({ x: x - originPoint.current.x, y: y - originPoint.current.y }); chooseTarget(x, y); },
    end(id) { const target = overRef.current; finish(); if (target && target !== id) commit(document => moveWidget(document, id, target)); }, cancel: finish
  };
  function remove(widget: WidgetInstance): void { Alert.alert('إزالة الويدجت؟', 'ستُحذف بيانات هذا الويدجت من اللوحة.', [{ text: 'إلغاء', style: 'cancel' }, { text: 'إزالة', style: 'destructive', onPress: () => commit(document => removeWidget(document, widget.i)) }]); }
  function reorder(id: string, delta: number): void { const index = dashboard.widgets.findIndex(widget => widget.i === id), target = dashboard.widgets[index + delta]; if (target) commit(document => moveWidget(document, id, target.i)); }
  return <AdaptivePanes primary={<View style={{ flex: 1 }} onLayout={event => setBounds(event.nativeEvent.layout)}>
    <ScrollView ref={scroll} contentContainerStyle={contentStyle} scrollEnabled={!dragging} onContentSizeChange={(_width, height) => { contentHeight.current = height; }} onScroll={event => { scrollOffset.current = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={16} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive">
      <Heading subtitle="لوحاتك وويدجتاتك المحفوظة على الجهاز ومع حسابك">مساحتي</Heading>
      <NativePicker label="اللوحة الحالية" value={board.document.activeId} options={board.document.dashboards.map(item => ({ label: item.name, value: item.id }))} onChange={id => commit(document => selectDashboard(document, id))} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><NativeAction title={editing ? 'إنهاء التعديل' : 'تعديل اللوحة'} style={{ flexGrow: 1, flexBasis: 140 }} disabled={!board.ready} onPress={() => { finish(); setEditing(value => !value); }} /><NativeAction title="إضافة ويدجت" style={{ flexGrow: 1, flexBasis: 140 }} disabled={!board.ready} onPress={() => setSheet('gallery')} /></View>
      <NativeAction title="إدارة اللوحات" onPress={() => { setName(dashboard.name); setSheet('dashboards'); }} disabled={!board.ready} />
      <Label secondary>{!board.ready ? 'جارٍ قراءة لوحتك' : board.status === 'saving' ? 'جارٍ الحفظ في الحساب' : board.status === 'saved' ? 'محفوظ في الحساب' : 'محفوظ على هذا الجهاز'}</Label>
      {board.error ? <Section><Label style={{ color: colors.danger }}>{board.error}</Label><NativeAction title="إعادة المحاولة" onPress={board.retry} /></Section> : null}
      {board.previous ? <Section><Label>حُفظت نسخة اللوحة المحلية قبل استبدالها بنسخة الحساب الأحدث.</Label><NativeAction title="استعادة النسخة السابقة" onPress={() => { void board.restore().catch(() => undefined); }} /><NativeAction title="تجاهل النسخة السابقة" onPress={() => { void board.dismiss().catch(() => undefined); }} /></Section> : null}
      {!dashboard.widgets.length && board.ready ? <Label secondary>اللوحة فارغة. أضف ويدجت للبدء.</Label> : null}
      <View ref={grid} style={{ width: Math.max(0, bounds.width - 36), height: Math.max(0, ...packed.map(item => (item.y + item.h) * 88 - 12)), position: 'relative' }}>
        {board.ready ? packed.map(item => <Animated.View key={item.widget.i} style={{ position: 'absolute', start: item.x * (cell + gap), top: item.y * 88,
          width: Math.max(0, item.w * cell + (item.w - 1) * gap), height: item.h * 76 + (item.h - 1) * 12, borderRadius: 18, backgroundColor: colors.surface,
          borderWidth: over === item.widget.i ? 2 : 0.5, borderColor: over === item.widget.i ? colors.accent : colors.separator, zIndex: dragging === item.widget.i ? 100 : 1,
          opacity: dragging === item.widget.i ? 0.85 : 1, transform: dragging === item.widget.i ? translation.getTranslateTransform() : [] }}>
          <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center', paddingHorizontal: 8, minHeight: 44 }}>
            {editing ? <DragHeader widget={item.widget} callbacks={callbacks} previous={() => reorder(item.widget.i, -1)} next={() => reorder(item.widget.i, 1)} /> : <Label style={{ flex: 1, fontWeight: '700' }}>{definition(item.widget.d)?.name ?? item.widget.d}</Label>}
            {editing ? <NativeIconAction title="إعدادات وحجم الويدجت" systemImage="slider.horizontal.3" onPress={() => { setConfigured(item.widget.i); setSheet('config'); }} /> : null}
          </View>
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 10, gap: 8 }} style={{ flex: 1 }}><WidgetView widget={item.widget} change={patch => board.change(document => updateWidgetConfig(document, item.widget.i, patch))} /></ScrollView>
        </Animated.View>) : null}
      </View>
    </ScrollView>
    <Modal visible={sheet !== null} presentationStyle="pageSheet" animationType="slide" onRequestClose={() => setSheet(null)}><SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={contentStyle} automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive">
      <Heading>{sheet === 'gallery' ? 'معرض الويدجتات' : sheet === 'dashboards' ? 'إدارة اللوحات' : 'إعدادات الويدجت'}</Heading><NativeAction title="تم" onPress={() => setSheet(null)} />
      {sheet === 'gallery' ? <><NativePicker label="التصنيف" value={category} options={[{ value: 'all', label: 'الكل' }, ...categories.map(item => ({ value: item.id, label: item.label }))]} onChange={setCategory} />
        {widgets.filter(widget => category === 'all' || widget.category === category).map(widget => { const exists = !widget.multiple && dashboard.widgets.some(item => item.d === widget.id); return <Section key={widget.id}><Label>{widget.name}</Label><NativeAction title={exists ? 'موجود في اللوحة' : 'إضافة'} disabled={exists || dashboard.widgets.length >= 40} onPress={() => { commit(document => addWidget(document, widget.id)); }} /></Section>; })}<Label secondary>الحد الأقصى ٤٠ ويدجت لكل لوحة.</Label></> : null}
      {sheet === 'dashboards' ? <><FormField label="اسم اللوحة" value={name} onChange={setName} maxLength={40} /><NativeAction title="تغيير اسم اللوحة الحالية" disabled={!name.trim()} onPress={() => commit(document => renameDashboard(document, document.activeId, name))} /><NativeAction title="إضافة لوحة فارغة بهذا الاسم" disabled={!name.trim() || board.document.dashboards.length >= 10} onPress={() => commit(document => addDashboard(document, name))} /><NativeAction title="حذف اللوحة الحالية" disabled={board.document.dashboards.length <= 1} onPress={() => Alert.alert('حذف اللوحة؟', 'ستُحذف جميع ويدجتات اللوحة الحالية.', [{ text: 'إلغاء', style: 'cancel' }, { text: 'حذف', style: 'destructive', onPress: () => { commit(document => removeDashboard(document, document.activeId)); setSheet(null); } }])} /><Label secondary>حتى ١٠ لوحات. يجب الاحتفاظ بلوحة واحدة على الأقل.</Label></> : null}
      {sheet === 'config' && configuredWidget ? <>
        <NativePicker label="عرض الويدجت" value={String(configuredWidget.w)} options={[...new Set([configuredWidget.w, 2, 3, 4, 6, 8, 12])].filter(value => value >= (configuredDefinition?.min[0] ?? 1) && value <= (configuredDefinition?.max[0] ?? 12)).sort((a, b) => a - b).map(value => ({ value: String(value), label: String(value) }))} onChange={value => commit(document => resizeWidget(document, configuredWidget.i, Number(value), configuredWidget.h))} />
        <NativePicker label="ارتفاع الويدجت" value={String(configuredWidget.h)} options={[...new Set([configuredWidget.h, 1, 2, 3, 4, 6, 8])].filter(value => value >= (configuredDefinition?.min[1] ?? 1) && value <= (configuredDefinition?.max[1] ?? 8)).sort((a, b) => a - b).map(value => ({ value: String(value), label: String(value) }))} onChange={value => commit(document => resizeWidget(document, configuredWidget.i, configuredWidget.w, Number(value)))} />
        {configuredDefinition?.fields.map(field => field.type === 'switch' ? <NativeToggle key={field.key} title={field.label} value={configuredWidget.c[field.key] === true} onChange={value => commit(document => updateWidgetConfig(document, configuredWidget.i, { [field.key]: value }))} />
          : field.type === 'select' ? <NativePicker key={field.key} label={field.label} value={String(configuredWidget.c[field.key] ?? field.default)} options={field.options ?? []} onChange={value => commit(document => updateWidgetConfig(document, configuredWidget.i, { [field.key]: value }))} />
            : <View key={field.key}><Label>{field.label}: {String(configuredWidget.c[field.key] ?? field.default)}</Label><NativeSlider label={field.label} value={Number(configuredWidget.c[field.key] ?? field.default)} min={field.min ?? 0} max={field.max ?? 100} step={1} onChange={value => commit(document => updateWidgetConfig(document, configuredWidget.i, { [field.key]: Math.round(value) }))} /></View>)}
        <NativeAction title="نقل إلى السابق" onPress={() => reorder(configuredWidget.i, -1)} /><NativeAction title="نقل إلى التالي" onPress={() => reorder(configuredWidget.i, 1)} /><NativeAction title="إزالة الويدجت" systemImage="trash" onPress={() => { remove(configuredWidget); setSheet(null); }} />
      </> : null}
    </ScrollView></SafeAreaView></Modal>
  </View>} />;
}
export default BoardScreen;

// PORT STATUS: source resources/js/Pages/Board/Index.tsx and _components/BoardGrid.tsx; confidence medium; todos 2 native drag autoscroll and compact widget configuration verification.
