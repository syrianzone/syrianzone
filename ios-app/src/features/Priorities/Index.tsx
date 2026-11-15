import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, ScrollView, View } from 'react-native';
import { Slider, Stepper } from '@expo/ui/swift-ui';
import { accessibilityLabel } from '@expo/ui/swift-ui/modifiers';
import * as Clipboard from 'expo-clipboard';
import { AdaptivePanes, contentStyle, Heading, Label, Section } from '../../components';
import { NativeAction, NativePicker, NativeThemeHost, NativeToggle } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { readDocument, writeDocument } from '../../platform/storage';
import { shareText } from '../../platform/links';
import type { FeatureScreenProps } from '../../platform/features';
import { allocate, COMPARISONS, decodeSharedState, encodeSharedState, initialState, INITIAL_TOPICS, interdependencies, persona, shareSummary, toggleSubfile, totalAllocated, type PriorityState } from './model';
import { PriorityRadar } from './Radar';
import { PriorityStory } from './Story';

export function PrioritiesScreen({ params }: FeatureScreenProps): React.JSX.Element {
  const { colors } = useTheme();
  const [state, setState] = useState<PriorityState>(initialState);
  const stateRef = useRef(state);
  const [comparison, setComparison] = useState('average');
  const [expanded, setExpanded] = useState(() => new Set(INITIAL_TOPICS.map(topic => topic.id)));
  const [banner, setBanner] = useState(true);
  const [story, setStory] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadedLink = useRef<string | undefined>(undefined);
  useEffect(() => {
    let active = true;
    void readDocument('sz-priorities-banner-dismissed', (value): boolean => { if (typeof value !== 'boolean') throw new Error('تفضيل غير صالح'); return value; }, false).then(dismissed => { if (active) setBanner(!dismissed); }).catch(() => { if (active) setError('تعذّر قراءة تفضيل المقدمة'); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!params.state || params.state === loadedLink.current) return;
    loadedLink.current = params.state;
    try { const restored = decodeSharedState(params.state); stateRef.current = restored; setState(restored); setError(null); } catch { setError('رابط الأولويات غير صالح. يمكنك البدء بخطة جديدة.'); }
  }, [params.state]);
  const total = totalAllocated(state);
  const dependencies = useMemo(() => interdependencies(state), [state]);
  const profile = useMemo(() => persona(state), [state]);
  const update = (next: PriorityState) => { stateRef.current = next; setState(next); setMessage(null); setError(null); };
  const assign = (id: string, value: number) => { const next = allocate(stateRef.current, id, value); update(next); if ((next.points[id] ?? 0) < Math.round(value)) setError('تم بلوغ الموازنة القصوى:100 نقطة'); };
  const toggle = (id: string) => { try { update(toggleSubfile(stateRef.current, id)); } catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذّر اختيار الملف'); } };
  const perform = async (action: () => Promise<void>, success?: string) => { setError(null); setMessage(null); try { await action(); if (success) setMessage(success); } catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذّر إكمال الإجراء'); } };
  const url = () => `https://syrian.zone/priorities?state=${encodeURIComponent(encodeSharedState(stateRef.current))}`;
  const requireComplete = () => { if (totalAllocated(stateRef.current) !== 100) throw new Error('يرجى توزيع النقاط المئة كاملة قبل المشاركة'); };
  const header = <View style={{ gap: 16 }}><Heading subtitle="وازن100 نقطة بين ملفات مستقبل سوريا، واختر خمسة ملفات فرعية كحد أقصى">سوريا حسب أولوياتك</Heading>
    {banner ? <Section><Label>لا توجد إجابة صحيحة واحدة. جرّب توزيع اهتمامك، وقارن رؤيتك، واكتشف ترابط الملفات.</Label><NativeAction title="إخفاء المقدمة" onPress={() => void perform(async () => { await writeDocument('sz-priorities-banner-dismissed', true); setBanner(false); })} /></Section> : null}
    <Section><Label style={{ fontSize: 22, fontWeight: '700' }}>الموزّع: {total} من100</Label><Label secondary>المتبقي: {100 - total} نقطة. الملفات المختارة: {state.selected.length} من5.</Label></Section>
    {error ? <Section><Label style={{ color: colors.danger }}>{error}</Label></Section> : null}{message ? <Label style={{ color: colors.success }}>{message}</Label> : null}</View>;
  const footer = <View style={{ gap: 16 }}><NativeAction title="إعادة ضبط النقاط والملفات" systemImage="arrow.counterclockwise" onPress={() => update(initialState())} />
    <Section><Heading>رؤيتك مقارنةً بالرؤى الأخرى</Heading><NativePicker label="نموذج المقارنة" value={comparison} onChange={setComparison} options={Object.entries(COMPARISONS).map(([value, item]) => ({ value, label: item.title }))} />
      <PriorityRadar state={state} comparison={comparison} /><Label secondary>الخط المتصل: خطتك. الخط المتقطع: {COMPARISONS[comparison]?.title}</Label>
      {INITIAL_TOPICS.map(topic => <Label key={topic.id} secondary>{topic.emoji} {topic.name}: {state.points[topic.id] ?? 0}%، المقارنة {COMPARISONS[comparison]?.points[topic.id] ?? 0}%</Label>)}</Section>
    <Section><Heading subtitle={dependencies.explanation}>تشابك القرارات: {dependencies.complexity}%</Heading><Label>{dependencies.label}</Label>
      {dependencies.alerts.map(alert => <View key={alert.id} style={{ gap: 6, borderTopWidth: 1, borderColor: colors.separator, paddingTop: 10 }}><Label style={{ fontWeight: '600' }}>{alert.fulfilled ? '✓' : '!'} {alert.name}</Label>{alert.warning ? <Label secondary>{alert.warning}</Label> : null}<Label secondary>{alert.fulfilled ? 'المتطلبات المحددة مستوفاة' : `متطلبات لم تخترها: ${alert.missingNames.join('، ')}`}</Label></View>)}</Section>
    {profile ? <Section><Label>{profile.emoji} {profile.tag}</Label><Heading subtitle={profile.desc}>{profile.title}</Heading></Section> : <Label secondary>وزّع النقاط المئة لعرض بروفايل أولوياتك وإتاحة المشاركة.</Label>}
    <Section><NativeAction title="نسخ الملخص" systemImage="doc.on.doc" onPress={() => void perform(async () => { requireComplete(); await Clipboard.setStringAsync(shareSummary(stateRef.current)); }, 'تم نسخ الملخص')} />
      <NativeAction title="نسخ رابط خطتي" systemImage="link" onPress={() => void perform(async () => { requireComplete(); await Clipboard.setStringAsync(url()); }, 'تم نسخ الرابط')} />
      <NativeAction title="مشاركة خطتي" systemImage="square.and.arrow.up" onPress={() => void perform(async () => { requireComplete(); await shareText(shareSummary(stateRef.current), url()); })} />
      <NativeAction title="بطاقة للمشاركة" systemImage="photo" onPress={() => { try { requireComplete(); setStory(true); } catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذّر فتح البطاقة'); } }} /></Section>
  </View>;
  return <><AdaptivePanes primary={<FlatList data={INITIAL_TOPICS} keyExtractor={topic => topic.id} contentContainerStyle={contentStyle} ListHeaderComponent={header} ListFooterComponent={footer}
    renderItem={({ item: topic }) => <Section style={{ marginVertical: 8 }}><NativeAction title={`${topic.emoji} ${topic.name}`} systemImage={expanded.has(topic.id) ? 'chevron.up' : 'chevron.down'} onPress={() => setExpanded(previous => { const next = new Set(previous); if (next.has(topic.id)) next.delete(topic.id); else next.add(topic.id); return next; })} />
      <Label style={{ fontWeight: '700' }}>{state.points[topic.id] ?? 0} نقطة</Label>
      <NativeThemeHost matchContents={{ vertical: true }}><Slider value={state.points[topic.id] ?? 0} min={0} max={100} step={1} upperLimit={100 - total + (state.points[topic.id] ?? 0)} onValueChange={value => assign(topic.id, value)} modifiers={[accessibilityLabel(`نقاط ${topic.name}`)]} /></NativeThemeHost>
      <NativeThemeHost matchContents={{ vertical: true }}><Stepper label="تعديل النقاط" value={state.points[topic.id] ?? 0} min={0} max={100 - total + (state.points[topic.id] ?? 0)} step={1} onValueChange={value => assign(topic.id, value)} modifiers={[accessibilityLabel(`تعديل نقاط ${topic.name}`)]} /></NativeThemeHost>
      {expanded.has(topic.id) ? <><Label secondary>{topic.desc}</Label>{topic.subFiles.map(sub => <View key={sub.id}><NativeToggle title={sub.name} value={state.selected.includes(sub.id)} onChange={() => toggle(sub.id)} /><Label secondary style={{ fontSize: 13 }}>{sub.desc}</Label></View>)}</> : null}
    </Section>} />} />
    <Modal visible={story} presentationStyle="pageSheet" animationType="slide" onRequestClose={() => setStory(false)}>{story ? <AdaptivePanes primary={<ScrollView contentContainerStyle={contentStyle}><NativeAction title="إغلاق البطاقة" systemImage="xmark" onPress={() => setStory(false)} /><PriorityStory state={state} /></ScrollView>} /> : null}</Modal>
  </>;
}
// PORT STATUS: source resources/js/Pages/Priorities/PrioritiesApp.tsx; confidence medium; todos 0.
