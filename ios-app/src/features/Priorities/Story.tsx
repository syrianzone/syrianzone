import { useEffect, useRef, useState } from 'react';
import Svg, { Circle, G, Line, Path, Polygon, Rect, Text as SvgText, TSpan } from 'react-native-svg';
import { Label } from '../../components';
import { NativeAction, NativeSegmented } from '../../ui/native';
import { themeColors, useTheme, type AppearanceMode } from '../../ui/theme';
import { shareSvgPng } from '../../platform/files';
import { INITIAL_TOPICS, persona, type PriorityState } from './model';
import { PRIORITIES_QR_PATH } from './artwork';

function wrap(text: string, columns: number): string[] {
  return text.split(/\s+/).reduce<string[]>((lines, word) => { const last = lines.length - 1; if (last >= 0 && `${lines[last]} ${word}`.length <= columns) lines[last] += ` ${word}`; else lines.push(word); return lines; }, []);
}
// PORT NOTE: Original360x640 story layout is rendered directly as native SVG, including source flag/QR and six allocation bars.
export function PriorityStory({ state }: { state: PriorityState }): React.JSX.Element {
  const { mode } = useTheme();
  const [appearance, setAppearance] = useState<AppearanceMode>(mode);
  const colors = themeColors[appearance];
  const card = useRef<Svg | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const lifetime = useRef<AbortController | null>(null);
  useEffect(() => { const controller = new AbortController(); lifetime.current = controller; return () => { generation.current += 1; controller.abort(); }; }, []);
  const profile = persona(state);
  const topics = [...INITIAL_TOPICS].sort((a, b) => (state.points[b.id] ?? 0) - (state.points[a.id] ?? 0));
  const selected = state.selected.map(id => INITIAL_TOPICS.flatMap(topic => topic.subFiles).find(sub => sub.id === id)?.name ?? id);
  const point = (index: number, radius: number) => ({ x: 180 + Math.cos(index * Math.PI / 3 - Math.PI / 2) * radius, y: 132 + Math.sin(index * Math.PI / 3 - Math.PI / 2) * radius });
  const polygon = (values: number[]) => values.map((value, index) => { const p = point(index, value); return `${p.x},${p.y}`; }).join(' ');
  const exportImage = async () => {
    if (busy || !card.current || !lifetime.current) return;
    const signal = lifetime.current.signal;
    const version = generation.current; const svg = card.current;
    setBusy(true); setError(null);
    try {
      if (version !== generation.current) return;
      await shareSvgPng(svg, { filename: `Syrian-Consensus-Story-${Date.now()}.png`, width: 1080, height: 1920, signal });
    } catch (reason) { if (version === generation.current) setError(reason instanceof Error ? reason.message : 'تعذّر إنشاء الصورة'); }
    finally { if (version === generation.current) setBusy(false); }
  };
  return <><NativeSegmented options={[{ value: 'light', label: 'فاتح' }, { value: 'dark', label: 'داكن' }]} value={appearance} onChange={setAppearance} disabled={busy} label="مظهر بطاقة المشاركة" />
    <Svg ref={card} width="100%" height={640} viewBox="0 0 360 640" accessibilityRole="image" accessibilityLabel={`بطاقة أولوياتي: ${profile?.title ?? ''}. ${topics.map(topic => `${topic.name} ${state.points[topic.id] ?? 0} بالمئة`).join('، ')}`}>
      <Rect width={360} height={640} rx={22} fill={colors.background} /><Rect x={14} y={14} width={332} height={612} rx={18} fill={colors.surface} stroke={colors.separator} />
      <G transform="translate(300,32) scale(0.035)"><Path d="M0 0h900v600H0z" fill="#000" /><Path d="M0 0h900v400H0z" fill="#fff" /><Path d="M0 0h900v200H0z" fill="#007a3d" /><Path d="m176.26 375 48.738-150 48.738 150-127.6-92.705h157.72m322.4 92.705 48.738-150 48.738 150-127.6-92.705h157.72m-352.6 92.705 48.738-150 48.738 150-127.6-92.705h157.72" fill="#ce1126" /></G>
      <SvgText x={290} y={40} textAnchor="end" fill={colors.text} fontSize={12} fontWeight="800">المساحة السورية</SvgText><SvgText x={290} y={56} textAnchor="end" fill={colors.secondary} fontSize={8}>بوصلة أولويات العمل بعد التحرير</SvgText>
      <Rect x={24} y={25} width={48} height={48} rx={4} fill="#fff" /><G transform="translate(26,27) scale(1.42)"><Path d={PRIORITIES_QR_PATH} stroke="#000" strokeWidth={1} /></G>
      <SvgText x={82} y={43} fill={colors.secondary} fontSize={8}>صمّم بروفايلك</SvgText><SvgText x={82} y={58} fill={colors.accent} fontSize={9}>syrian.zone/priorities</SvgText><Line x1={25} x2={335} y1={84} y2={84} stroke={colors.separator} />
      {[0.25, 0.5, 0.75, 1].map(ratio => <Polygon key={ratio} points={polygon(INITIAL_TOPICS.map(() => ratio * 34))} fill="none" stroke={colors.separator} />)}
      {INITIAL_TOPICS.map((topic, index) => { const end = point(index, 34); return <Line key={topic.id} x1={180} y1={132} x2={end.x} y2={end.y} stroke={colors.separator} />; })}
      <Polygon points={polygon(INITIAL_TOPICS.map(topic => (state.points[topic.id] ?? 0) * 0.34))} fill={colors.accent} fillOpacity={0.25} stroke={colors.accent} strokeWidth={1.5} />
      {INITIAL_TOPICS.map((topic, index) => { const p = point(index, (state.points[topic.id] ?? 0) * 0.34); return <Circle key={topic.id} cx={p.x} cy={p.y} r={2} fill={colors.accent} />; })}
      <SvgText x={180} y={188} fill={colors.accent} fontSize={10} fontWeight="700" textAnchor="middle">{profile?.tag}</SvgText>
      <SvgText x={180} y={209} fill={colors.text} fontSize={13} fontWeight="800" textAnchor="middle">{wrap(profile?.title ?? '', 39).map((line, index) => <TSpan key={index} x={180} dy={index ? 18 : 0}>{line}</TSpan>)}</SvgText>
      <SvgText x={180} y={246} fill={colors.secondary} fontSize={9} textAnchor="middle">{wrap(profile?.desc ?? '', 65).slice(0, 4).map((line, index) => <TSpan key={index} x={180} dy={index ? 13 : 0}>{line}</TSpan>)}</SvgText>
      <Rect x={25} y={298} width={310} height={194} rx={12} fill={colors.elevated} stroke={colors.separator} /><SvgText x={322} y={317} textAnchor="end" fill={colors.secondary} fontSize={9} fontWeight="700">توزيع موازنة نقاط الاهتمام المائة بالكامل</SvgText>
      {topics.map((topic, index) => { const y = 338 + index * 26; const value = state.points[topic.id] ?? 0; return <G key={topic.id}><SvgText x={320} y={y} textAnchor="end" fill={colors.text} fontSize={8.5}>{topic.name}</SvgText><SvgText x={39} y={y} fill={colors.accent} fontSize={9} fontWeight="700">{value}%</SvgText><Rect x={39} y={y + 6} width={282} height={4} rx={2} fill={colors.separator} /><Rect x={321 - value * 2.82} y={y + 6} width={value * 2.82} height={4} rx={2} fill={colors.accent} /></G>; })}
      {selected.length ? <><Rect x={25} y={502} width={310} height={100} rx={12} fill={colors.background} stroke={colors.separator} /><SvgText x={322} y={519} textAnchor="end" fill={colors.secondary} fontSize={9} fontWeight="700">الملفات الفرعية الأكثر إلحاحاً</SvgText>{selected.map((name, index) => <SvgText key={name} x={320} y={536 + index * 13} textAnchor="end" fill={colors.text} fontSize={7.7}>{name}</SvgText>)}</> : null}
      <SvgText x={180} y={620} textAnchor="middle" fill={colors.secondary} fontSize={8}>المساحة السورية - مشروع سوري مفتوح المصدر</SvgText>
    </Svg>
    <NativeAction title={busy ? 'جارٍ تجهيز الصورة' : 'مشاركة الصورة أو حفظها'} systemImage="square.and.arrow.up" disabled={busy} onPress={() => void exportImage()} prominent />{error ? <Label>{error}</Label> : null}</>;
}
// PORT STATUS: source resources/js/Pages/Priorities/PrioritiesApp.tsx; confidence medium; todos 0.
