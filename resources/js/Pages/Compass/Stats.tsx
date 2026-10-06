import React, { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Components/ui/card';
import { Button } from '@/Components/ui/button';
import { BarChart3, Users, Compass } from 'lucide-react';
import AxisBars from '@/Pages/Compass/components/AxisBars';
import QuestionAverage, { type QuestionScope } from '@/Pages/Compass/components/QuestionAverage';
import type { AxisId } from '@/Pages/Compass/data/types';

interface Stats {
    total: number;
    byVersion: Record<string, number>;
    bySpectrum: Record<string, { id: string; count: number }[]>;
    axisAverages: Record<string, Partial<Record<AxisId, number | null>>>;
    questions: Record<string, Record<string, QuestionScope>>;
}

interface Props {
    stats: Stats;
    personas: { id: string; name: string }[];
}

const SCOPES = [
    { id: 'all', label: 'الكل' },
    { id: 'short', label: 'قصيرة' },
    { id: 'standard', label: 'قياسية' },
    { id: 'full', label: 'كاملة' },
];

export default function CompassStats({ stats, personas }: Props) {
    const [scope, setScope] = useState('all');

    const personaName = (id: string) => personas.find((p) => p.id === id)?.name ?? id;

    const spectrum = stats.bySpectrum[scope] ?? stats.bySpectrum.all ?? [];
    const spectrumTotal = spectrum.reduce((s, x) => s + x.count, 0);
    const maxSpectrum = Math.max(1, ...spectrum.map((s) => s.count));
    const axisForScope = stats.axisAverages[scope] ?? stats.axisAverages.all;
    const scopeLabel = SCOPES.find((s) => s.id === scope)?.label ?? 'الكل';

    return (
        <MainLayout>
            <Head>
                <title>إحصاءات بوصلة سوريا | Syrian Zone</title>
                <meta
                    name="description"
                    content="إحصاءات عامة مجهولة الهوية عن نتائج بوصلة سوريا: الأعداد، توزّع الأنماط، والمتوسطات حسب طول الاختبار."
                />
            </Head>

            <div className="min-h-screen flex flex-col bg-background text-foreground" dir="rtl">
                <section className="bg-card py-8 border-b border-border">
                    <div className="container mx-auto px-4 text-center max-w-3xl">
                        <h1 className="text-2xl md:text-3xl font-bold flex items-center justify-center gap-2">
                            <BarChart3 className="h-7 w-7 text-primary" />
                            إحصاءات بوصلة سوريا
                        </h1>
                        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                            أرقام عامة مجهولة الهوية من النتائج التي اختار أصحابها مشاركتها للإحصاء.
                            لا تُعرض أي بيانات فردية ولا معرّفات.
                        </p>
                        <div className="mt-4">
                            <Button asChild variant="outline" className="gap-2">
                                <Link href="/compass">
                                    <Compass className="h-4 w-4" /> خُض الاختبار
                                </Link>
                            </Button>
                        </div>
                    </div>
                </section>

                <main className="flex-1 container mx-auto px-3 sm:px-4 py-6 max-w-4xl space-y-5">
                    {stats.total === 0 ? (
                        <Card>
                            <CardContent className="py-10 text-center text-muted-foreground">
                                لا توجد إحصاءات بعد.
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                                <Card>
                                    <CardContent className="pt-5 flex items-center gap-3">
                                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                            <Users className="h-5 w-5" />
                                        </span>
                                        <div>
                                            <p className="text-xs text-muted-foreground">إجمالي المشاركات</p>
                                            <p className="text-xl font-extrabold">{stats.total}</p>
                                        </div>
                                    </CardContent>
                                </Card>
                                {(['short', 'standard', 'full'] as const).map((v) => (
                                    <Card key={v}>
                                        <CardContent className="pt-5">
                                            <p className="text-xs text-muted-foreground">
                                                النسخة {SCOPES.find((s) => s.id === v)?.label}
                                            </p>
                                            <p className="text-xl font-extrabold">{stats.byVersion[v] ?? 0}</p>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>

                            <Card>
                                <CardContent className="pt-5 flex flex-wrap items-center gap-2">
                                    <span className="text-sm text-muted-foreground me-1">عرض المتوسطات حسب طول الاختبار:</span>
                                    {SCOPES.map((s) => (
                                        <button
                                            key={s.id}
                                            onClick={() => setScope(s.id)}
                                            className={`rounded-lg border px-3 py-1.5 text-sm font-bold transition ${
                                                scope === s.id
                                                    ? 'border-primary bg-primary text-primary-foreground'
                                                    : 'border-border hover:bg-muted/50'
                                            }`}
                                        >
                                            {s.label}
                                        </button>
                                    ))}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base">توزّع الأنماط</CardTitle>
                                    <CardDescription className="text-xs">
                                        {spectrumTotal} مشاركة مصنّفة على الأنماط
                                        {scope !== 'all' && ` (النسخة ${scopeLabel})`}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {spectrum.map((s) => (
                                        <div key={s.id} className="flex items-center gap-2">
                                            <span className="w-40 shrink-0 truncate text-xs">{personaName(s.id)}</span>
                                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                                                <div
                                                    className="h-full rounded-full bg-primary"
                                                    style={{ width: `${(s.count / maxSpectrum) * 100}%` }}
                                                />
                                            </div>
                                            <span className="w-10 shrink-0 text-left text-xs font-bold tabular-nums">{s.count}</span>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base">المتوسط على المحاور</CardTitle>
                                    <CardDescription className="text-xs">
                                        متوسط موضع المشاركين على الأحد عشر محوراً (الاتجاه كما يراه المستخدم).
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <AxisBars axes={axisForScope} />
                                </CardContent>
                            </Card>

                            <QuestionAverage questions={stats.questions} scope={scope} scopeLabel={scopeLabel} />
                        </>
                    )}
                </main>
            </div>
        </MainLayout>
    );
}
