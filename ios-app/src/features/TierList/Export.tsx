import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Svg, { G, Image as SvgImage, Rect, SvgXml, Text as SvgText, TSpan } from 'react-native-svg';
import { Heading, Label } from '../../components';
import { NativeAction } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { downloadImageDataUri, shareSvgPng } from '../../platform/files';
import { TIER_KEYS, TIERS, type Board, type TierPage } from './model';
import { TIER_EXPORT_LOGO } from './artwork';

const wrap = (value: string, width: number): string[] => value.split(/\s+/).reduce<string[]>((rows, word) => { const index = rows.length - 1; if (index >= 0 && `${rows[index]} ${word}`.length <= width) rows[index] += ` ${word}`; else rows.push(word); return rows; }, []);
export function TierExport({ data, board }: { data: TierPage; board: Board }): React.JSX.Element {
  const { colors } = useTheme(); const svg = useRef<Svg | null>(null); const [images, setImages] = useState<Record<string, string | null>>({}); const [loaded, setLoaded] = useState<Set<string>>(() => new Set()); const [preparing, setPreparing] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const ids = useMemo(() => TIER_KEYS.flatMap(tier => board.tiers[tier]), [board]);
  const lifetime = useRef<AbortController | null>(null);
  useEffect(() => { const controller = new AbortController(); lifetime.current = controller; return () => controller.abort(); }, [board]);
  const candidates = useMemo(() => new Map(data.candidates.map(candidate => [candidate.id, candidate])), [data]);
  useEffect(() => {
    let active = true; let cursor = 0; const next: Record<string, string | null> = {};
    setPreparing(true); setLoaded(new Set()); setImages({});
    const worker = async () => { while (active && cursor < ids.length) { const id = ids[cursor++]!; const url = candidates.get(id)?.imageUrl; try { next[id] = url ? await downloadImageDataUri(url) : null; } catch { next[id] = null; } } };
    void Promise.all(Array.from({ length: Math.min(4, Math.max(1, ids.length)) }, worker)).then(() => { if (active) { setImages(next); setPreparing(false); } });
    return () => { active = false; };
  }, [ids, candidates]);
  const layout = useMemo(() => { let y = 16; return TIER_KEYS.map(tier => { const rows = Math.max(1, Math.ceil(board.tiers[tier].length / 6)); const height = 20 + rows * 160 + (rows - 1) * 10; const section = { tier, y, height }; y += height + 8; return section; }); }, [board]);
  const last = layout[layout.length - 1]!; const height = last.y + last.height + 80;
  const waiting = Object.keys(images).some(id => images[id] && !loaded.has(id));
  const missing = ids.filter(id => !images[id]).length;
  return <><Heading subtitle="التصنيف الحالي فقط، مع الصور والأسماء والرتب">صورة قائمة التقييم</Heading>{preparing ? <Label secondary>جارٍ تجهيز صور المرشحين</Label> : missing ? <Label secondary>تعذّر تحميل {missing} صورة. ستظهر أماكنها فارغة في البطاقة.</Label> : null}
    <ScrollView horizontal contentContainerStyle={{ paddingBottom: 12 }}><View style={{ width: 500 }}><Svg ref={svg} width={500} height={height / 2} viewBox={`0 0 1000 ${height}`} accessibilityRole="image" accessibilityLabel={TIER_KEYS.map(tier => `${tier} ${TIERS[tier].arabic}: ${board.tiers[tier].map(id => candidates.get(id)?.name).join('، ')}`).join('؛ ')}>
      <Rect width={1000} height={height} fill="#ffffff" />{layout.map(section => <G key={section.tier}><Rect x={16} y={section.y} width={90} height={section.height} fill={TIERS[section.tier].color} /><SvgText x={61} y={section.y + 28} fill="#fff" textAnchor="middle" fontSize={24} fontWeight="700">{section.tier}</SvgText><SvgText x={61} y={section.y + 60} fill="#fff" textAnchor="middle" fontSize={15}>{TIERS[section.tier].arabic}</SvgText><Rect x={106} y={section.y} width={878} height={section.height} fill="#fff" stroke="#e5e7eb" strokeWidth={2} strokeDasharray="4,4" />
        {board.tiers[section.tier].map((id, index) => { const candidate = candidates.get(id)!; const row = Math.floor(index / 6); const inRow = Math.min(6, board.tiers[section.tier].length - row * 6); const x = 106 + Math.floor((878 - (inRow * 120 + (inRow - 1) * 8)) / 2) + (index % 6) * 128; const y = section.y + 10 + row * 170; const nameLines = wrap(candidate.name, 17).slice(0, 2); return <G key={id}><Rect x={x} y={y} width={120} height={160} fill="#fff" stroke="#e5e7eb" /><Rect x={x + 12} y={y + 8} width={96} height={96} rx={6} fill="#f3f4f6" />{images[id] ? <SvgImage x={x + 12} y={y + 8} width={96} height={96} href={images[id]!} preserveAspectRatio="xMidYMid slice" onLoad={() => setLoaded(previous => { const next = new Set(previous); next.add(id); return next; })} /> : null}<SvgText x={x + 60} y={y + 118} textAnchor="middle" fill="#111" fontSize={12} fontWeight="600">{nameLines.map((line, lineIndex) => <TSpan key={lineIndex} x={x + 60} dy={lineIndex ? 14 : 0}>{line}</TSpan>)}</SvgText>{candidate.title ? <SvgText x={x + 60} y={y + 122 + nameLines.length * 14} textAnchor="middle" fill="#111" fontSize={10}>{wrap(candidate.title, 20).slice(0, 1).join(' ')}</SvgText> : null}</G>; })}</G>)}
      <SvgText x={480} y={height - 35} textAnchor="end" fill="#111" fontSize={16} fontWeight="700">syrian.zone/tierlist</SvgText><G transform={`translate(492,${height - 56})`}><SvgXml xml={TIER_EXPORT_LOGO} width={61} height={32} /></G>
    </Svg></View></ScrollView><NativeAction title={busy ? 'جارٍ تجهيز الصورة' : 'مشاركة الصورة أو حفظها'} disabled={busy || preparing || waiting} systemImage="square.and.arrow.up" onPress={() => { if (!svg.current || !lifetime.current) return; const card = svg.current; const signal = lifetime.current.signal; setBusy(true); setError(null); const scale = Math.min(2, Math.sqrt(15_000_000 / (1000 * height))); void shareSvgPng(card, { filename: 'tier-list.png', width: Math.floor(1000 * scale), height: Math.floor(height * scale), signal }).catch(reason => { if (!signal.aborted) setError(reason instanceof Error ? reason.message : 'تعذّر إنشاء الصورة'); }).finally(() => { if (!signal.aborted) setBusy(false); }); }} />{waiting && !preparing ? <Label secondary>جارٍ رسم الصور داخل البطاقة</Label> : null}{error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}</>;
}
// PORT STATUS: source resources/js/Domain/polls/exportTierList.ts; confidence medium; todos 0.
