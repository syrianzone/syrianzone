import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Modal, ScrollView, View } from 'react-native';
import type Svg from 'react-native-svg';
import { AdaptivePanes, contentStyle, EmptyState, FormField, Heading, Label, Section } from '../../components';
import { openExternal } from '../../platform/links';
import { shareFile, shareSvgImage } from '../../platform/files';
import { readDocument, writeDocument } from '../../platform/storage';
import { useScreenActive } from '../../platform/lifecycle';
import { NativeAction, NativeColorPicker, NativePicker } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { AlignmentDrawing } from './Drawing';
import {
  addDot,
  alignmentSvg,
  AXIS_LABELS,
  createAlignmentWriter,
  decodeAlignment,
  defaultAlignment,
  moveDot,
  QUADRANT_LABELS,
  positionFromFields,
  removeDot,
  type Alignment,
  type Axes,
  type Colors
} from './model';

const DOCUMENT = 'alignment.v1';
type Format = 'png' | 'jpg' | 'svg';
export function AlignmentScreen(): React.JSX.Element {
  const active = useScreenActive();
  const { colors } = useTheme(),
    [state, setState] = useState(defaultAlignment),
    [ready, setReady] = useState(false),
    [loadRevision, setLoadRevision] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null),
    [saveError, setSaveError] = useState<string | null>(null),
    [actionError, setActionError] = useState<string | null>(null);
  const error = loadError ?? saveError ?? actionError;
  const [savedState, setSavedState] = useState<Alignment | null>(null),
    [positions, setPositions] = useState<Record<number, { x: string; y: string }>>({});
  const [saving, setSaving] = useState(false),
    [exporting, setExporting] = useState(false),
    [format, setFormat] = useState<Format>('png');
  const [pointDragging, setPointDragging] = useState(false);
  const [selected, setSelected] = useState<number | null>(null),
    [pointsOpen, setPointsOpen] = useState(false),
    [deleteId, setDeleteId] = useState<number | null>(null),
    [reset, setReset] = useState(false);
  const svg = useRef<Svg | null>(null),
    controller = useRef<AbortController | null>(null),
    alive = useRef(true),
    latest = useRef(state),
    restored = useRef(false),
    saveId = useRef(0);
  latest.current = state;
  const [writer] = useState(() => createAlignmentWriter((value) => writeDocument(DOCUMENT, value)));
  const save = useCallback(
    async (value: Alignment) => {
      const id = ++saveId.current;
      if (alive.current) setSaving(true);
      try {
        await writer.save(value);
        if (alive.current && id === saveId.current) {
          setSaveError(null);
          setSavedState(value);
        }
      } catch (reason) {
        if (alive.current && id === saveId.current) setSaveError(reason instanceof Error ? reason.message : 'تعذّر حفظ الرسم على الجهاز.');
      } finally {
        if (alive.current && id === saveId.current) setSaving(false);
      }
    },
    [writer]
  );
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
      if (restored.current) void save(latest.current);
    };
  }, [save]);
  useEffect(() => {
    let loading = true;
    void readDocument(DOCUMENT, decodeAlignment, defaultAlignment())
      .then((value) => {
        if (loading) {
          setState(value);
          restored.current = true;
          setReady(true);
          setLoadError(null);
          setSavedState(value);
        }
      })
      .catch((reason) => {
        if (loading) setLoadError(reason instanceof Error ? reason.message : 'تعذّر قراءة الرسم المحفوظ.');
      });
    return () => {
      loading = false;
    };
  }, [loadRevision]);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      void save(state);
    }, 250);
    return () => clearTimeout(timer);
  }, [state, ready, save]);
  useEffect(() => {
    if (!active) {
      controller.current?.abort();
      if (restored.current) void save(latest.current);
    }
  }, [active, save]);
  const change = (update: (previous: Alignment) => Alignment) => {
    if (!ready || exporting || controller.current) return;
    try {
      const next = update(latest.current);
      latest.current = next;
      setState(next);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'تعذّر تعديل الرسم.');
    }
  };
  const perform = async (task: () => Promise<void>) => {
    setActionError(null);
    try {
      await task();
    } catch (reason) {
      if (alive.current) setActionError(reason instanceof Error ? reason.message : 'تعذّر إكمال الإجراء.');
    }
  };
  const exportDrawing = async () => {
    if (!ready || exporting || controller.current) return;
    const current = new AbortController();
    controller.current = current;
    setExporting(true);
    setActionError(null);
    try {
      if (format === 'svg')
        await shareFile({ text: alignmentSvg(state), filename: 'political-compass.svg', mimeType: 'image/svg+xml', signal: current.signal });
      else {
        if (!svg.current) throw new Error('الرسم غير جاهز للتصدير.');
        await shareSvgImage(svg.current, {
          filename: `political-compass.${format}`,
          width: 600,
          height: 600,
          format,
          quality: 0.9,
          signal: current.signal
        });
      }
    } catch (reason) {
      if (alive.current && !current.signal.aborted) setActionError(reason instanceof Error ? reason.message : 'تعذّر تصدير الرسم.');
    } finally {
      if (controller.current === current) {
        controller.current = null;
        if (alive.current) setExporting(false);
      }
    }
  };
  const currentDot = state.dots.find((dot) => dot.id === selected) ?? null;
  const header = (
    <View style={{ gap: 12 }}>
      <Heading subtitle="خصّص المحاور والألوان وأضف نقاطك. الرسم محفوظ محلياً على هذا الجهاز.">مولد البوصلة السياسية المخصص</Heading>
      {error ? (
        <Section>
          <Label style={{ color: colors.danger }}>{error}</Label>
          <NativeAction
            title={saveError ? 'إعادة حفظ الرسم' : !ready ? 'إعادة قراءة الرسم المحفوظ' : 'إغلاق الرسالة'}
            disabled={exporting || saving}
            onPress={() => {
              if (saveError) void save(state);
              else if (!ready) {
                setLoadError(null);
                setLoadRevision((value) => value + 1);
              } else setActionError(null);
            }}
          />
          {!ready ? <NativeAction title="حذف الرسم المحفوظ وبدء رسم جديد" destructive onPress={() => setReset(true)} /> : null}
        </Section>
      ) : null}
      {!ready && !error ? <EmptyState title="جارٍ قراءة الرسم المحفوظ" /> : null}
    </View>
  );
  const drawing = ready ? (
    <View style={{ gap: 12 }}>
      <AlignmentDrawing state={state} disabled={exporting} svgRef={svg} onChange={change} onSelect={setSelected} onDraggingChange={setPointDragging} />
      <Label secondary>اضغط لإضافة نقطة، أو اسحب نقطة موجودة لنقلها. مواضع النقاط تتكيف مع حجم الشاشة.</Label>
      <NativeAction
        title="إضافة نقطة في الوسط"
        disabled={exporting}
        onPress={() =>
          change((previous) => {
            const next = addDot(previous, { x: 0.5, y: 0.5 }, Date.now());
            setSelected(next.dots.at(-1)!.id);
            return next;
          })
        }
      />
      <NativeAction title={`تعديل ${state.dots.length} نقطة`} disabled={exporting} onPress={() => setPointsOpen(true)} />
      <Label secondary>
        {saveError ? 'لم يُحفظ آخر تعديل' : saving || savedState !== state ? 'جارٍ حفظ الرسم على الجهاز' : 'الرسم محفوظ محلياً'}
      </Label>
    </View>
  ) : null;
  const controls = ready ? (
    <View style={{ gap: 16 }}>
      <Section>
        <Heading>محاور البوصلة</Heading>
        {(Object.keys(AXIS_LABELS) as (keyof Axes)[]).map((key) => (
          <FormField
            key={key}
            label={AXIS_LABELS[key]}
            value={state.axes[key]}
            onChange={(value) => change((previous) => ({ ...previous, axes: { ...previous.axes, [key]: value } }))}
            maxLength={1000}
            disabled={exporting}
          />
        ))}
      </Section>
      <Section>
        <Heading>ألوان الأقسام</Heading>
        {(Object.keys(QUADRANT_LABELS) as (keyof Colors)[]).map((key) => (
          <NativeColorPicker
            key={key}
            label={QUADRANT_LABELS[key]}
            value={state.colors[key]}
            onChange={(value) => change((previous) => ({ ...previous, colors: { ...previous.colors, [key]: value } }))}
            disabled={exporting}
          />
        ))}
      </Section>
      <Section>
        <Heading>تصدير البوصلة</Heading>
        <NativePicker<Format>
          label="نوع الملف"
          value={format}
          onChange={setFormat}
          disabled={exporting}
          options={[
            { value: 'png', label: 'PNG' },
            { value: 'jpg', label: 'JPG' },
            { value: 'svg', label: 'SVG' }
          ]}
        />
        <NativeAction
          title={exporting ? 'جارٍ تجهيز الملف' : 'تصدير ومشاركة'}
          systemImage="square.and.arrow.up"
          prominent
          disabled={exporting}
          onPress={() => void exportDrawing()}
        />
      </Section>
      <Section>
        <Label>© 2025 syrian.zone</Label>
        <Label>تم التطوير بواسطة هادي الأحمد</Label>
        <NativeAction title="الموقع الشخصي للمطور" onPress={() => void perform(() => openExternal('https://hadealahmad.com'))} />
        <NativeAction title="حساب المطور على X" onPress={() => void perform(() => openExternal('https://x.com/hadealahmad'))} />
      </Section>
    </View>
  ) : null;
  return (
    <>
      <AdaptivePanes
        primary={
          <ScrollView
            contentContainerStyle={contentStyle}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            keyboardDismissMode="interactive"
          >
            {header}
            {controls}
          </ScrollView>
        }
        secondary={<ScrollView scrollEnabled={!pointDragging} contentContainerStyle={contentStyle}>{drawing}</ScrollView>}
        compact={
          <ScrollView
            scrollEnabled={!pointDragging}
            contentContainerStyle={contentStyle}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            keyboardDismissMode="interactive"
          >
            {header}
            {drawing}
            {controls}
          </ScrollView>
        }
      />
      <Modal
        visible={pointsOpen || reset}
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setPointsOpen(false);
          setDeleteId(null);
          setReset(false);
        }}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <AdaptivePanes
            primary={deleteId !== null || reset ? (
              <ScrollView contentContainerStyle={contentStyle}>
                <Heading>{reset ? 'حذف الرسم المحفوظ؟' : 'حذف هذه النقطة؟'}</Heading>
                <Label>{reset ? 'سيُستبدل الرسم المحفوظ برسم فارغ. لا يمكن التراجع.' : 'ستُحذف النقطة من الرسم المحفوظ على هذا الجهاز.'}</Label>
                <NativeAction
                  title="تأكيد الحذف"
                  destructive
                  onPress={() => {
                    if (reset) {
                      const empty = defaultAlignment();
                      setState(empty);
                      latest.current = empty;
                      restored.current = true;
                      setReady(true);
                      setLoadError(null);
                      setReset(false);
                      void save(empty);
                    } else if (deleteId !== null) {
                      change((previous) => removeDot(previous, deleteId));
                      if (selected === deleteId) setSelected(null);
                      setDeleteId(null);
                    }
                  }}
                />
                <NativeAction
                  title="إلغاء"
                  onPress={() => {
                    setDeleteId(null);
                    setReset(false);
                  }}
                />
              </ScrollView>
            ) : (
              <FlatList
                data={state.dots}
                automaticallyAdjustKeyboardInsets
                keyboardDismissMode="interactive"
                keyExtractor={(dot) => String(dot.id)}
                contentContainerStyle={contentStyle}
                keyboardShouldPersistTaps="handled"
                ListHeaderComponent={
                  <View style={{ gap: 12 }}>
                    <Heading>نقاط البوصلة</Heading>
                    {actionError ? <Label style={{ color: colors.danger }}>{actionError}</Label> : null}
                    <NativeAction title="تم" onPress={() => setPointsOpen(false)} />
                    {currentDot ? <Label secondary>المحددة: {currentDot.name}</Label> : null}
                  </View>
                }
                renderItem={({ item: dot }) => (
                  <Section style={{ marginVertical: 6 }}>
                    <FormField
                      label={`اسم النقطة ${dot.id}`}
                      value={dot.name}
                      onChange={(name) =>
                        change((previous) => ({ ...previous, dots: previous.dots.map((item) => (item.id === dot.id ? { ...item, name } : item)) }))
                      }
                      maxLength={1000}
                      disabled={exporting}
                    />
                    <FormField
                      label="الموضع الأفقي، من 0 يساراً إلى 100 يميناً"
                      value={positions[dot.id]?.x ?? String(Math.round(dot.x * 10000) / 100)}
                      keyboardType="decimal-pad"
                      onChange={(x) =>
                        setPositions((previous) => ({
                          ...previous,
                          [dot.id]: { x, y: previous[dot.id]?.y ?? String(Math.round(dot.y * 10000) / 100) }
                        }))
                      }
                      disabled={exporting}
                    />
                    <FormField
                      label="الموضع العمودي، من 0 أعلى إلى 100 أسفل"
                      value={positions[dot.id]?.y ?? String(Math.round(dot.y * 10000) / 100)}
                      keyboardType="decimal-pad"
                      onChange={(y) =>
                        setPositions((previous) => ({
                          ...previous,
                          [dot.id]: { y, x: previous[dot.id]?.x ?? String(Math.round(dot.x * 10000) / 100) }
                        }))
                      }
                      disabled={exporting}
                    />
                    <NativeAction
                      title="حفظ موضع النقطة"
                      disabled={exporting}
                      onPress={() => {
                        try {
                          const point = positionFromFields(positions[dot.id]?.x ?? String(dot.x * 100), positions[dot.id]?.y ?? String(dot.y * 100));
                          change((previous) => moveDot(previous, dot.id, point));
                          setPositions((previous) => {
                            const next = { ...previous };
                            delete next[dot.id];
                            return next;
                          });
                          setActionError(null);
                        } catch (reason) {
                          setActionError(reason instanceof Error ? reason.message : 'الموضع غير صالح.');
                        }
                      }}
                    />
                    <NativeAction title={`حذف ${dot.name || 'النقطة'}`} destructive disabled={exporting} onPress={() => setDeleteId(dot.id)} />
                  </Section>
                )}
                ListEmptyComponent={<EmptyState title="لا توجد نقاط بعد" detail="أضف نقطة من الرسم أو زر الإضافة في الوسط." />}
              />
            )}
          />
        </View>
      </Modal>
    </>
  );
}
// PORT STATUS: source Pages/Alignment/{Index,CompassClient}.tsx; confidence medium; todos 2 native gesture/VoiceOver review and PNG/JPG/SVG share verification.
