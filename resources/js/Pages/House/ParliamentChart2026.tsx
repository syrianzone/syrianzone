import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/Components/ui/card';
import { Badge } from '@/Components/ui/badge';
import type { Member2026 } from './members2026';

export type Dim = 'governorate' | 'gender' | 'selection' | 'age';

const GOV_COLORS = ['#cb6d62', '#8a5100', '#8b902d', '#10703a', '#00a5a9', '#005d95', '#a482d2', '#854079', '#556A4E', '#A73F46', '#b5892e', '#5b7fa6', '#7a5c3e', '#4e8a7a'];
const GENDER_COLOR: Record<string, string> = { M: '#556A4E', F: '#A73F46' };
// Omran selection_method has exactly two values: انتخابات (136) / تعيين (70)
const SELECTION_COLOR: Record<string, string> = { 'انتخابات': '#556A4E', 'تعيين': '#A73F46' };

export function ageOf(m: Member2026): number | null {
    const y = parseInt(m.birth_year, 10);
    if (!y || y < 1900 || y > 2100) return null;
    return new Date().getFullYear() - y;
}

export function ageGroupOf(m: Member2026): string {
    const a = ageOf(m);
    if (a === null) return 'غير محدد';
    if (a < 30) return 'lt30';
    if (a < 40) return '30s';
    if (a < 50) return '40s';
    if (a < 60) return '50s';
    return '60p';
}

export const AGE_LABEL: Record<string, string> = {
    lt30: 'أقل من 30',
    '30s': '30-39',
    '40s': '40-49',
    '50s': '50-59',
    '60p': '60+',
    'غير محدد': 'غير محدد',
};

const AGE_COLOR: Record<string, string> = {
    lt30: '#00a5a9',
    '30s': '#8b902d',
    '40s': '#8a5100',
    '50s': '#cb6d62',
    '60p': '#005d95',
    'غير محدد': '#888',
};

function groupKey(m: Member2026, dim: Dim): string {
    if (dim === 'gender') return m.gender === 'F' ? 'F' : 'M';
    if (dim === 'selection') return m.selection_method || 'غير محدد';
    if (dim === 'age') return ageGroupOf(m);
    return m.governorate_ar || 'غير محدد';
}

// Compact perfect half-donut: concentric semicircular rows, seats spread
// evenly along each arc, rows weighted by arc length (outer rows hold more).
const CX = 200;
const CY = 188;
const R_INNER = 72;
const R_OUTER = 178;
const ROWS = 7;
const DOT_R = 4.2;

// Half-donut with wedge columns: each row spans the FULL 180° (ends sit on
// the baseline), and each group occupies a contiguous angular wedge.
// Wedges are filled from right to left in legend order (largest first).
function hemicycleWedges(active: Member2026[], groupOrder: string[], dim: Dim): { x: number; y: number; g: string; m: Member2026 }[] {
    const n = active.length;
    if (n === 0) return [];
    const radii = Array.from({ length: ROWS }, (_, r) => R_INNER + ((R_OUTER - R_INNER) * (r + 1)) / ROWS);
    const total = radii.reduce((a, b) => a + b, 0);
    const rowCaps = radii.map((r) => Math.max(1, Math.round((n * r) / total)));
    let diff = n - rowCaps.reduce((a, b) => a + b, 0);
    let i = ROWS - 1;
    while (diff !== 0) {
        rowCaps[((i % ROWS) + ROWS) % ROWS] += Math.sign(diff);
        diff -= Math.sign(diff);
        i -= 1;
        if (i < -ROWS * 4) break;
    }

    const totals = new Map<string, number>();
    active.forEach((m) => { const g = groupKey(m, dim); totals.set(g, (totals.get(g) || 0) + 1); });
    const remaining = new Map(totals);

    const dots: { x: number; y: number; g: string; m: Member2026 }[] = [];
    const byGroup = new Map<string, Member2026[]>();
    active.forEach((m) => {
        const g = groupKey(m, dim);
        if (!byGroup.has(g)) byGroup.set(g, []);
        byGroup.get(g)!.push(m);
    });
    const taken = new Map<string, number>(groupOrder.map((g) => [g, 0]));

    rowCaps.forEach((cap, r) => {
        // Proportional split of this row across groups (largest-remainder)
        const shares = groupOrder.map((g) => {
            const exact = ((totals.get(g) || 0) * cap) / n;
            return { g, floor: Math.floor(exact), frac: exact - Math.floor(exact) };
        });
        let left = cap - shares.reduce((a, s) => a + s.floor, 0);
        shares.sort((a, b) => b.frac - a.frac);
        for (let k = 0; k < shares.length && left > 0; k++, left--) shares[k].floor += 1;
        // Never exceed what the group still has left
        shares.forEach((s) => {
            const avail = (totals.get(s.g) || 0) - (taken.get(s.g) || 0);
            if (s.floor > avail) { left += s.floor - avail; s.floor = avail; }
        });
        const order = new Map(shares.map((s) => [s.g, s.floor]));
        let k = 0;
        while (left > 0) {
            const g = shares[k % shares.length].g;
            const avail = (totals.get(g) || 0) - (taken.get(g) || 0) - (order.get(g) || 0);
            if (avail > 0) { order.set(g, (order.get(g) || 0) + 1); left--; }
            k++;
            if (k > n + groupOrder.length) break;
        }

        // Lay the row left→right, first group takes the rightmost slots
        let slot = 0;
        [...groupOrder].reverse().forEach((g) => {
            const cnt = order.get(g) || 0;
            for (let s = 0; s < cnt; s++, slot++) {
                const frac = (slot + 0.5) / cap;
                const theta = Math.PI * (1 - frac);
                const list = byGroup.get(g)!;
                const mi = taken.get(g)!;
                taken.set(g, mi + 1);
                dots.push({ x: CX + radii[r] * Math.cos(theta), y: CY - radii[r] * Math.sin(theta), g, m: list[mi] });
            }
        });
    });
    return dots;
}

interface ChartProps {
    members: Member2026[];
    dim: Dim;
    onDimChange: (d: Dim) => void;
    selectedKey: string;
    onLegendClick: (dim: Dim, key: string) => void;
}

export default function ParliamentChart2026({ members, dim, onDimChange, selectedKey, onLegendClick }: ChartProps) {
    const active = useMemo(() => members.filter((m) => (m.status || 'active') === 'active'), [members]);
    const [hoverGroup, setHoverGroup] = useState<string | null>(null);

    const groups = useMemo(() => {
        const map = new Map<string, number>();
        active.forEach((m) => { const g = groupKey(m, dim); map.set(g, (map.get(g) || 0) + 1); });
        // Largest group rightmost, descending as you go left — for every dimension
        return [...map.entries()].sort((a, b) => b[1] - a[1]);
    }, [active, dim]);
    const groupOrder = useMemo(() => groups.map(([g]) => g), [groups]);
    // Wedge columns: contiguous angular sectors, filled right → left
    const dots = useMemo(() => hemicycleWedges(active, groupOrder, dim), [active, groupOrder, dim]);

    const govColor = useMemo(() => {
        const govs = Array.from(new Set(active.map((m) => m.governorate_ar || 'غير محدد'))).sort();
        return Object.fromEntries(govs.map((g, idx) => [g, GOV_COLORS[idx % GOV_COLORS.length]]));
    }, [active]);

    const colorOf = (m: Member2026) => {
        if (dim === 'gender') return GENDER_COLOR[m.gender] || '#888';
        if (dim === 'selection') return SELECTION_COLOR[m.selection_method] || '#888';
        if (dim === 'age') return AGE_COLOR[ageGroupOf(m)] || '#888';
        return govColor[m.governorate_ar || 'غير محدد'];
    };
    const legendColor = (k: string) =>
        dim === 'gender' ? GENDER_COLOR[k] : dim === 'selection' ? SELECTION_COLOR[k] : dim === 'age' ? AGE_COLOR[k] : govColor[k];
    const labelOf = (k: string) =>
        dim === 'gender' ? (k === 'F' ? 'إناث' : 'ذكور') : dim === 'age' ? (AGE_LABEL[k] || k) : k;
    const hoverCount = hoverGroup ? groups.find(([k]) => k === hoverGroup)?.[1] || 0 : 0;

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
                <div className="flex gap-2 flex-wrap">
                    <Badge className="cursor-pointer" variant={dim === 'selection' ? 'default' : 'outline'} onClick={() => { onDimChange('selection'); setHoverGroup(null); }}>طريقة التعيين</Badge>
                    <Badge className="cursor-pointer" variant={dim === 'governorate' ? 'default' : 'outline'} onClick={() => { onDimChange('governorate'); setHoverGroup(null); }}>المحافظة</Badge>
                    <Badge className="cursor-pointer" variant={dim === 'gender' ? 'default' : 'outline'} onClick={() => { onDimChange('gender'); setHoverGroup(null); }}>الجنس</Badge>
                    <Badge className="cursor-pointer" variant={dim === 'age' ? 'default' : 'outline'} onClick={() => { onDimChange('age'); setHoverGroup(null); }}>الفئة العمرية</Badge>
                </div>
                <p className="text-xs text-muted-foreground">اضغط على أي فئة لتصفية الجدول أدناه</p>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="relative w-full max-w-[520px] mx-auto" dir="ltr">
                    <svg viewBox="0 0 400 200" className="w-full h-auto" role="img" aria-label="توزيع مقاعد المجلس">
                        {[92, 118, 144, 170].map((r) => (
                            <path key={r} d={`M ${CX - r} ${CY} A ${r} ${r} 0 0 1 ${CX + r} ${CY}`} fill="none" stroke="currentColor" opacity={0.08} />
                        ))}
                        {dots.map((d, idx) => (
                            <circle
                                key={d.m.member_number || idx}
                                cx={d.x}
                                cy={d.y}
                                r={DOT_R}
                                fill={colorOf(d.m)}
                                opacity={hoverGroup && hoverGroup !== d.g ? 0.2 : 1}
                                onMouseEnter={() => setHoverGroup(d.g)}
                                onMouseLeave={() => setHoverGroup(null)}
                            />
                        ))}
                    </svg>
                    {hoverGroup && (
                        <div className="absolute bottom-1 right-1 bg-card border border-border rounded-md px-3 py-1.5 text-sm shadow" dir="rtl">
                            <span className="font-bold">{labelOf(hoverGroup)}</span>
                            <span className="text-muted-foreground text-xs"> — {hoverCount} عضواً{active.length ? ` (${((hoverCount / active.length) * 100).toFixed(1)}%)` : ''}</span>
                        </div>
                    )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1.5 max-w-[520px] mx-auto" dir="rtl">
                    {groups.map(([k, v]) => (
                        <button
                            key={k}
                            type="button"
                            onClick={() => onLegendClick(dim, k)}
                            title="تصفية الجدول بهذه الفئة"
                            className={`inline-flex items-center gap-1.5 text-sm rounded px-1 -mx-1 cursor-pointer text-right transition ${hoverGroup === k ? 'bg-muted' : ''} ${selectedKey === k ? 'ring-1 ring-primary bg-primary/5' : ''}`}
                            onMouseEnter={() => setHoverGroup(k)}
                            onMouseLeave={() => setHoverGroup(null)}
                        >
                            <span className="inline-block h-3 w-3 rounded-full border border-black/10 shrink-0" style={{ background: legendColor(k) }} />
                            <span className="font-medium">{labelOf(k)}</span>
                            <span className="text-muted-foreground text-xs">{v} ({active.length ? ((v / active.length) * 100).toFixed(1) : '0'}%)</span>
                        </button>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
