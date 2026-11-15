import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Rect, SvgXml, Text as SvgText, TSpan } from 'react-native-svg';
import { axisDisplay } from '../../../../resources/js/Domain/compass/axisDisplay';
import { Heading, Label, Section } from '../../components';
import { NativeAction } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { shareSvgPng } from '../../platform/files';
import { AXES, type CompassResult, type Spectrum } from './model';
import { personaIconXml } from './PersonaIcon';

export function AxisBars({ scores }: { scores: CompassResult['scores'] }): React.JSX.Element {
  const { colors } = useTheme();
  return <View style={{ gap: 16 }}>{AXES.map(axis => {
    const value = scores[axis.id]; const display = axisDisplay(axis); const amount = Math.abs(value ?? 0) * 140; const left = (value ?? 0) >= 0 === display.positiveOnLeft;
    return <View key={axis.id} style={{ gap: 4 }}><Label style={{ fontWeight: '600' }}>{axis.name}</Label><Label secondary>{display.rightLabel} / {display.leftLabel}، {value == null ? 'لا توجد إجابات' : `${Math.round(value * 100)}%`}</Label><Svg width="100%" height={20} viewBox="0 0 300 20" accessible={false}><Rect x={10} y={7} width={280} height={6} rx={3} fill={colors.separator} /><Line x1={150} x2={150} y1={3} y2={17} stroke={colors.secondary} />{value != null ? <Rect x={left ? 150 - amount : 150} y={7} width={amount} height={6} rx={3} fill={colors.accent} /> : null}</Svg></View>;
  })}</View>;
}
export function CompassPlot({ scores }: { scores: CompassResult['scores'] }): React.JSX.Element {
  const { colors } = useTheme(); const x = scores.central_federal; const y = scores.auth_lib;
  return <Svg width="100%" height={320} viewBox="0 0 320 320" accessibilityRole="image" accessibilityLabel={`المحور الأفقي ${x == null ? 'غير مجاب' : Math.round(x * 100)}، المحور العمودي ${y == null ? 'غير مجاب' : Math.round(y * 100)}`}>
    <Rect x={5} y={5} width={310} height={310} rx={16} fill={colors.surface} stroke={colors.separator} /><Line x1={10} x2={310} y1={160} y2={160} stroke={colors.separator} /><Line x1={160} x2={160} y1={10} y2={310} stroke={colors.separator} />
    <SvgText x={160} y={23} textAnchor="middle" fill={colors.secondary} fontSize={12}>تحرّرية/مدنية</SvgText><SvgText x={160} y={303} textAnchor="middle" fill={colors.secondary} fontSize={12}>سلطوية</SvgText><SvgText x={307} y={148} textAnchor="end" fill={colors.secondary} fontSize={10}>مركزي/وحدوي</SvgText><SvgText x={13} y={148} fill={colors.secondary} fontSize={10}>لامركزي/فدرالي</SvgText>
    {x != null && y != null ? <><Circle cx={160 - x * 125} cy={160 - y * 125} r={7} fill={colors.accent} stroke={colors.surface} strokeWidth={2} /><SvgText x={160 - x * 125} y={146 - y * 125} textAnchor="middle" fill={colors.accent} fontSize={12} fontWeight="700">أنت</SvgText></> : null}
  </Svg>;
}
export function AlignmentBars({ result }: { result: CompassResult }): React.JSX.Element {
  const { mode, colors } = useTheme();
  const blocs = [{ id: 'west', label: 'غربي: أمريكا وأوروبا', color: mode === 'dark' ? '#60a5fa' : '#2563eb' }, { id: 'gulf', label: 'خليجي: السعودية والخليج', color: mode === 'dark' ? '#34d399' : '#059669' }, { id: 'turkish', label: 'تركي: تركيا وقطر', color: mode === 'dark' ? '#f87171' : '#dc2626' }, { id: 'east', label: 'شرقي: إيران والصين وروسيا', color: mode === 'dark' ? '#c084fc' : '#7c3aed' }, { id: 'neutral', label: 'حياد: غير منحاز', color: mode === 'dark' ? '#94a3b8' : '#64748b' }] as const;
  const maximum = Math.max(1, ...blocs.map(bloc => Math.max(0, result.align[bloc.id]))); const total = blocs.reduce((sum, bloc) => sum + Math.max(0, result.align[bloc.id]), 0);
  return <View style={{ gap: 14 }}>{blocs.map(bloc => <View key={bloc.id}><Label>{bloc.label}، {total ? Math.round(Math.max(0, result.align[bloc.id]) / total * 100) : 0}%</Label><Svg width="100%" height={18} viewBox="0 0 300 18" accessible={false}><Rect x={5} y={6} width={290} height={6} rx={3} fill={colors.separator} /><Rect x={295 - Math.max(0, result.align[bloc.id]) / maximum * 290} y={6} width={Math.max(0, result.align[bloc.id]) / maximum * 290} height={6} rx={3} fill={bloc.color} /></Svg></View>)}</View>;
}
const lines = (value: string, columns: number) => value.split(/\s+/).reduce<string[]>((rows, word) => { const index = rows.length - 1; if (index >= 0 && `${rows[index]} ${word}`.length <= columns) rows[index] += ` ${word}`; else rows.push(word); return rows; }, []);
export function CompassStory({ result, spectrum }: { result: CompassResult; spectrum: Spectrum | null }): React.JSX.Element {
  const { colors } = useTheme(); const card = useRef<Svg | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const lifetime = useRef<AbortController | null>(null);
  useEffect(() => { const controller = new AbortController(); lifetime.current = controller; setBusy(false); setError(null); return () => controller.abort(); }, [result]);
  const exportImage = async () => { if (!card.current || busy || !lifetime.current) return; const svg = card.current; const signal = lifetime.current.signal; setBusy(true); setError(null); try {
    await shareSvgPng(svg, { filename: `bousalat-syria-${Date.now()}.png`, width: 1080, height: 1920, signal });
  } catch (reason) { if (!signal?.aborted) setError(reason instanceof Error ? reason.message : 'تعذّر إنشاء الصورة'); } finally { if (!signal?.aborted) setBusy(false); } };
  return <Section><Heading>صورة النتيجة للمشاركة</Heading><Svg ref={card} width="100%" height={640} viewBox="0 0 360 640" accessibilityRole="image" accessibilityLabel={`بطاقة نتيجة ${spectrum?.name ?? 'البوصلة'}`}><Rect width={360} height={640} fill={colors.background} /><Circle cx={180} cy={43} r={21} fill={colors.accentMuted} stroke={colors.accent} /><G transform="translate(166,29)"><SvgXml xml={personaIconXml(spectrum?.icon, colors.accent)} width={28} height={28} /></G>
    <SvgText x={180} y={91} fill={colors.text} fontSize={19} fontWeight="800" textAnchor="middle">{spectrum?.name ?? 'نتيجتك'}</SvgText><SvgText x={180} y={113} fill={colors.secondary} fontSize={10} textAnchor="middle">{lines(spectrum?.short ?? '', 56).slice(0, 3).map((line, index) => <TSpan key={index} x={180} dy={index ? 15 : 0}>{line}</TSpan>)}</SvgText>
    <SvgText x={180} y={168} textAnchor="middle" fill={colors.accent} fontSize={8}>{spectrum?.stances.slice(0, 3).join(' · ')}</SvgText><Rect x={22} y={185} width={316} height={416} rx={14} fill={colors.surface} stroke={colors.separator} /><SvgText x={321} y={205} textAnchor="end" fill={colors.secondary} fontSize={10}>موقعك على المحاور</SvgText>
    {AXES.map((axis, index) => { const y = 227 + index * 34; const value = result.scores[axis.id]; const display = axisDisplay(axis); const amount = Math.min(Math.abs(value ?? 0), 1) * 142; const left = (value ?? 0) >= 0 === display.positiveOnLeft; return <ViewlessBar key={axis.id} y={y} value={value ?? null} right={display.rightLabel} left={display.leftLabel} markerLeft={left} amount={amount} />; })}
    <SvgText x={180} y={618} textAnchor="middle" fill={colors.secondary} fontSize={8}>بوصلة سوريا · مشروع سوري مفتوح المصدر</SvgText><SvgText x={180} y={632} textAnchor="middle" fill={colors.accent} fontSize={9}>syrian.zone/compass</SvgText></Svg><NativeAction title={busy ? 'جارٍ تجهيز الصورة' : 'مشاركة صورة النتيجة أو حفظها'} systemImage="square.and.arrow.up" onPress={() => void exportImage()} disabled={busy} />{error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}</Section>;
}
function ViewlessBar({ y, value, right, left, markerLeft, amount }: { y: number; value: number | null; right: string; left: string; markerLeft: boolean; amount: number }): React.JSX.Element {
  const { colors } = useTheme();
  return <><SvgText x={320} y={y} textAnchor="end" fill={colors.text} fontSize={8}>{right}</SvgText><SvgText x={40} y={y} fill={colors.text} fontSize={8}>{left}</SvgText><SvgText x={180} y={y} textAnchor="middle" fill={colors.accent} fontSize={8}>{value == null ? 'غير مجاب' : `${value > 0 ? '+' : ''}${value.toFixed(2)}`}</SvgText><Rect x={38} y={y + 8} width={284} height={6} rx={3} fill={colors.separator} /><Line x1={180} x2={180} y1={y + 6} y2={y + 16} stroke={colors.secondary} />{value != null ? <Rect x={markerLeft ? 180 - amount : 180} y={y + 8} width={amount} height={6} rx={3} fill={colors.accent} /> : null}</>;
}
// PORT STATUS: source resources/js/Pages/Compass/components/CompassCanvas.tsx and CompassShareCard.tsx; confidence medium; todos 0.
