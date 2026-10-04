import React from 'react';
import { Head, Link } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Components/ui/card';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Separator } from '@/Components/ui/separator';
import {
    Compass,
    Users,
    CalendarDays,
    ShieldCheck,
    ListChecks,
    Activity,
    TrendingUp,
} from 'lucide-react';
import AxisBars from '@/Pages/Compass/components/AxisBars';
import AlignmentCard from '@/Pages/Compass/components/AlignmentCard';
import { SPECTRA } from '@/Pages/Compass/data/spectra';
import type { AlignBloc, AxisId } from '@/Pages/Compass/data/types';

interface RecentRow {
    id: number;
    createdAt: string | null;
    version: string;
    spectrum: string | null;
    consistency: number | null;
    answered: number;
    topScore: number | null;
}

interface Stats {
    total: number;
    last7: number;
    last30: number;
    byVersion: Record<string, number>;
    bySpectrum: { id: string; count: number }[];
    axisAverages: Partial<Record<AxisId, number | null>>;
    alignTotals: Record<AlignBloc, number>;
    avgConsistency: number | null;
    avgAnswered: number | null;
    daily: { date: string; count: number }[];
    recent: RecentRow[];
}

const VERSION_LABEL: Record<string, string> = { short: 'قصيرة', standard: 'قياسية', full: 'كاملة' };

const BLOC_LABEL: Record<AlignBloc, string> = {
    west: 'غربي',
    gulf: 'خليجي',
    turkish: 'تركي',
    east: 'شرقي',
    neutral: 'حياد',
};

const spectrumName = (id: string | null) => SPECTRA.find((s) => s.id === id)?.name ?? '—';

const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`);

function StatCard({
    icon: Icon,
    label,
    value,
    hint,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string | number;
    hint?: string;
}) {
    return (
        <Card>
            <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-xl font-extrabold leading-tight">{value}</p>
                        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default function CompassAdminIndex({ stats, canManageFigures = false }: { stats: Stats; canManageFigures?: boolean }) {
    const spectrumTotal = stats.bySpectrum.reduce((sum, s) => sum + s.count, 0);
    const maxSpectrum = Math.max(1, ...stats.bySpectrum.map((s) => s.count));
    const maxDaily = Math.max(1, ...stats.daily.map((d) => d.count));

    return (
        <MainLayout>
            <Head title="إحصاءات بوصلة سوريا" />
            <div className="container mx-auto max-w-5xl space-y-6 px-4 py-8" dir="rtl">
                <Card>
                    <CardHeader>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Compass className="h-6 w-6 text-primary" />
                                    إحصاءات «بوصلة سوريا»
                                </CardTitle>
                                <CardDescription className="mt-1">
                                    ملخّص مجهول الهوية للنتائج التي اختار أصحابها مشاركتها للإحصاء. لا تُحسب النتائج المحفوظة في الحسابات،
                                    ولا التي سُحبت موافقتها، ولا يظهر هنا أي معرّف شخصي.
                                </CardDescription>
                            </div>
                            {canManageFigures && (
                                <Button asChild variant="outline" className="gap-2">
                                    <Link href="/admin/compass/figures">
                                        <Compass className="h-4 w-4" />
                                        إدارة الشخصيات
                                    </Link>
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                </Card>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <StatCard icon={Users} label="إجمالي المشاركات المجهولة" value={stats.total} />
                    <StatCard icon={TrendingUp} label="آخر 7 أيام" value={stats.last7} />
                    <StatCard icon={CalendarDays} label="آخر 30 يوماً" value={stats.last30} />
                    <StatCard icon={ShieldCheck} label="متوسط الاتساق" value={pct(stats.avgConsistency)} />
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {/* Spectrum distribution */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">توزّع الأطياف</CardTitle>
                            <CardDescription className="text-xs">
                                {spectrumTotal > 0 ? `${spectrumTotal} مشاركة مصنّفة` : 'لا توجد بيانات بعد'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {stats.bySpectrum.length === 0 && (
                                <p className="text-sm text-muted-foreground">لا توجد بيانات بعد.</p>
                            )}
                            {stats.bySpectrum.map((s) => (
                                <div key={s.id} className="flex items-center gap-2">
                                    <span className="w-36 shrink-0 truncate text-xs">{spectrumName(s.id)}</span>
                                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                                        <div
                                            className="h-full rounded-full bg-primary"
                                            style={{ width: `${(s.count / maxSpectrum) * 100}%` }}
                                        />
                                    </div>
                                    <span className="w-10 shrink-0 text-left text-xs font-bold tabular-nums">
                                        {s.count}
                                    </span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Version + averages */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">توزّع النسخ والمتوسطات</CardTitle>
                            <CardDescription className="text-xs">حسب طول الاختبار الذي اختاره المشاركون</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                                {(['short', 'standard', 'full'] as const).map((v) => (
                                    <Badge key={v} variant="secondary" className="gap-1 text-[11px]">
                                        {VERSION_LABEL[v]}
                                        <span className="font-bold text-primary">{stats.byVersion[v] ?? 0}</span>
                                    </Badge>
                                ))}
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-1.5 text-muted-foreground">
                                    <ListChecks className="h-4 w-4" /> متوسط عدد الأسئلة المُجابة
                                </span>
                                <span className="font-bold">{stats.avgAnswered ?? '—'}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-1.5 text-muted-foreground">
                                    <ShieldCheck className="h-4 w-4" /> متوسط درجة الاتساق
                                </span>
                                <span className="font-bold">{pct(stats.avgConsistency)}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Axis averages */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">المتوسط على المحاور</CardTitle>
                        <CardDescription className="text-xs">
                            متوسط موضع كل المشاركين على الأحد عشر محوراً (الاتجاه كما يراه المستخدم).
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {stats.total > 0 ? (
                            <AxisBars axes={stats.axisAverages} />
                        ) : (
                            <p className="text-sm text-muted-foreground">لا توجد بيانات بعد.</p>
                        )}
                    </CardContent>
                </Card>

                {/* Alignment */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">التوجّه الخارجي</CardTitle>
                        <CardDescription className="text-xs">مجموع أوزان الكتل الخمس عبر المشاركات.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {stats.total > 0 ? (
                            <AlignmentCard align={stats.alignTotals} label={BLOC_LABEL} />
                        ) : (
                            <p className="text-sm text-muted-foreground">لا توجد بيانات بعد.</p>
                        )}
                    </CardContent>
                </Card>

                {/* Daily chart */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Activity className="h-4 w-4 text-primary" /> المشاركات اليومية (30 يوماً)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex h-24 items-end gap-[3px]">
                            {stats.daily.map((d) => (
                                <div
                                    key={d.date}
                                    className="flex-1 rounded-t bg-primary/70"
                                    style={{ height: `${Math.max(2, (d.count / maxDaily) * 100)}%` }}
                                    title={`${d.date}: ${d.count}`}
                                />
                            ))}
                        </div>
                        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                            <span>{stats.daily[0]?.date}</span>
                            <span>{stats.daily[stats.daily.length - 1]?.date}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Recent */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">أحدث المشاركات المجهولة</CardTitle>
                        <CardDescription className="text-xs">آخر 20 مشاركة، بلا أي معرّف شخصي.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {stats.recent.length === 0 ? (
                            <p className="text-sm text-muted-foreground">لا توجد بيانات بعد.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-right text-sm">
                                    <thead>
                                        <tr className="border-b border-border text-xs text-muted-foreground">
                                            <th className="px-2 py-2 font-medium">التاريخ</th>
                                            <th className="px-2 py-2 font-medium">النسخة</th>
                                            <th className="px-2 py-2 font-medium">الطيف</th>
                                            <th className="px-2 py-2 font-medium">الاتساق</th>
                                            <th className="px-2 py-2 font-medium">الأسئلة</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.recent.map((r) => (
                                            <tr key={r.id} className="border-b border-border/50">
                                                <td className="px-2 py-2 text-xs text-muted-foreground">
                                                    {r.createdAt ? new Date(r.createdAt).toLocaleString('ar') : '—'}
                                                </td>
                                                <td className="px-2 py-2">{VERSION_LABEL[r.version] ?? r.version}</td>
                                                <td className="px-2 py-2">{spectrumName(r.spectrum)}</td>
                                                <td className="px-2 py-2 tabular-nums">{pct(r.consistency)}</td>
                                                <td className="px-2 py-2 tabular-nums">{r.answered}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    );
}
