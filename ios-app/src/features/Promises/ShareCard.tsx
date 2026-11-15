import { useEffect, useRef, useState } from 'react';
import Svg, { G, Image as SvgImage, Rect, Text as SvgText, TSpan } from 'react-native-svg';
import { Heading, Label } from '../../components';
import { NativeAction } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { downloadImageDataUri, shareSvgPng } from '../../platform/files';
import { STATE_LABEL, type PromiseDetailData } from './model';
import { format } from './rules';

const wrap = (value: string, maximum: number): string[] => value.split(/\s+/).reduce<string[]>((rows, word) => { const index = rows.length - 1; if (index >= 0 && `${rows[index]} ${word}`.length <= maximum) rows[index] += ` ${word}`; else rows.push(word); return rows; }, []);
export function PromiseShareCard({ card }: { card: PromiseDetailData }): React.JSX.Element {
  const { colors } = useTheme(); const svg = useRef<Svg | null>(null); const operation = useRef<AbortController | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<(string | null)[]>([]); const [loaded, setLoaded] = useState<Set<number>>(() => new Set()); const [preparing, setPreparing] = useState(true);
  const people = [card.speaker, ...(card.coSpeakers ?? [])];
  useEffect(() => {
    let current = true; const controller = new AbortController(); operation.current = controller; setImages([]); setLoaded(new Set()); setPreparing(true); setBusy(false); setError(null);
    void Promise.all([card.speaker, ...(card.coSpeakers ?? [])].map(async speaker => { try { return speaker.image ? await downloadImageDataUri(speaker.image) : null; } catch { return null; } })).then(value => { if (current) { setImages(value); setPreparing(false); } });
    return () => { current = false; controller.abort(); };
  }, [card]);
  const caption = format.calendarCounterCaption(card.counter, card) ?? ({ left: 'يوماً حتى الموعد', today: 'الموعد اليوم', overdue: 'يوماً من التأخير', since: 'يوماً منذ إطلاقه', early: 'يوماً قبل الموعد', ontime: 'في يوم الموعد', late: 'يوماً بعد الموعد', took: 'يوماً بعد إطلاقه', closed: STATE_LABEL[card.state] })[card.counter.mode];
  const titleLines = wrap(card.title, 33); const titleLineHeight = Math.min(24, 96 / Math.max(1, titleLines.length));
  const waiting = images.some((image, index) => image !== null && !loaded.has(index));
  const exportImage = async () => { if (!svg.current || busy || preparing || waiting) return; const controller = operation.current; if (!controller || controller.signal.aborted) return; setBusy(true); setError(null); try { await shareSvgPng(svg.current, { filename: `promise-${card.number}.png`, width: 1080, height: 1080, signal: controller.signal }); } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'تعذّر إنشاء الصورة'); } finally { if (!controller.signal.aborted) setBusy(false); } };
  return <><Heading subtitle="صورة بعدّاد اليوم لنشرها على وسائل التواصل">صورة للمشاركة</Heading><Svg ref={svg} width="100%" height={360} viewBox="0 0 360 360" accessibilityRole="image" accessibilityLabel={`${card.title}، ${card.counter.value ?? ''} ${caption}`}>
    <Rect width={360} height={360} fill={colors.background} /><Rect x={12} y={12} width={336} height={336} rx={18} fill={colors.surface} stroke={colors.separator} />
    {people.map((person, index) => <G key={`${person.id}:${index}`}><Rect x={300 - index * 24} y={30} width={36} height={36} rx={18} fill={colors.accentMuted} />{images[index] ? <SvgImage x={300 - index * 24} y={30} width={36} height={36} href={images[index]!} preserveAspectRatio="xMidYMid slice" onLoad={() => setLoaded(previous => { const next = new Set(previous); next.add(index); return next; })} /> : null}</G>)}
    <SvgText x={290 - Math.max(0, people.length - 1) * 24} y={42} textAnchor="end" fill={colors.text} fontSize={10} fontWeight="700">{people.map(person => person.name).filter(Boolean).join(' و')}</SvgText><SvgText x={290 - Math.max(0, people.length - 1) * 24} y={60} textAnchor="end" fill={colors.secondary} fontSize={8}>{people.map(person => person.title).filter(Boolean).join(' · ')}</SvgText><SvgText x={28} y={83} fill={card.state === 'overdue' || card.state === 'broken' ? colors.danger : colors.accent} fontSize={11} fontWeight="700">{STATE_LABEL[card.state]}{card.keptLate ? '، بعد الموعد' : ''}</SvgText>
    <SvgText x={180} y={115} textAnchor="middle" fill={colors.text} fontSize={Math.min(17, titleLineHeight * 0.8)} fontWeight="800">{titleLines.map((line, index) => <TSpan key={index} x={180} dy={index ? titleLineHeight : 0}>{line}</TSpan>)}</SvgText>
    <SvgText x={180} y={244} textAnchor="middle" fill={card.state === 'overdue' ? colors.danger : colors.text} fontSize={58} fontWeight="800">{card.counter.value == null ? STATE_LABEL[card.state] : `${card.counter.mode === 'overdue' ? '+' : ''}${card.counter.value}`}</SvgText><SvgText x={180} y={271} textAnchor="middle" fill={colors.secondary} fontSize={12}>{caption}</SvgText>
    <Rect x={30} y={298} width={300} height={1} fill={colors.separator} /><SvgText x={330} y={319} textAnchor="end" fill={colors.secondary} fontSize={10}>{card.deadlineDate ? `الموعد ${format.formatDate(card.deadlineDate)}` : `أُطلق ${format.formatDate(card.statementDate)}`}</SvgText><SvgText x={30} y={319} fill={colors.text} fontSize={10} fontWeight="700">عداد الوعود</SvgText><SvgText x={30} y={337} fill={colors.secondary} fontSize={9}>syrian.zone/promises/{card.number}</SvgText>
  </Svg>{preparing || waiting ? <Label secondary>جارٍ تجهيز الصور داخل البطاقة</Label> : images.some(image => !image) ? <Label secondary>ستظهر الأسماء عندما لا تتوفر صور أصحاب الوعد.</Label> : null}<NativeAction title={busy ? 'جارٍ إنشاء الصورة' : 'مشاركة الصورة أو حفظها'} systemImage="square.and.arrow.up" disabled={busy || preparing || waiting} prominent onPress={() => void exportImage()} />{error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}</>;
}
// PORT STATUS: source resources/js/Pages/Promises/_components/ShareCardDialog.tsx; confidence medium; todos 0.
