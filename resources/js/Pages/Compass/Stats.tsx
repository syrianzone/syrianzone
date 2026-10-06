import React, { useMemo, useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Components/ui/card';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import {
    Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/Components/ui/select';
import { BarChart3, Users, Compass, ListChecks } from 'lucide-react';
import AxisBars from '@/Pages/Compass/components/AxisBars';
import { AXES } from '@/Pages/Compass/data/axes';
import { QUESTIONS } from '@/Pages/Compass/data/questions';
import { ALIGN_QUESTIONS } from '@/Pages/Compass/data/align';
import { axisKey, alignKey } from '@/Pages/Compass/lib/engine';
import type { AxisId } from '@/Pages/Compass/data/types';

interface QuestionScope {
    n: number;
    counts: number[]; // index 0..4 => answer -2..+2
}

interface Stats {
    total: number;
    byVersion: Record<string, number>;
    bySpectrum: { id: string; count: number }[];
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

const OPTION_LABELS = ['أعارض بشدة', 'أعارض', 'محايد', 'أوافق', 'أوافق بشدة'];

/** Below this many responses a public average is withheld (privacy + noise). */
const MIN_RESPONSES = 5;

const QUESTION_GROUPS = [
    ...AXES.map((a) => ({
        id: a.id,
        name: a.name,
        questions: QUESTIONS[a.id].map((q, i) => ({ key: axisKey(a.id, i), text: q.text })),
    })),
    {
        id: 'align',
        name: 'التحالف الخارجي',
        questions: ALIGN_QUESTIONS.map((q, i) => ({ key: alignKey(i), text: q.text })),
    },
];

const meanOf = (counts: number[] | undefined): number | null => {
    if (!counts) return null;
    const n = counts.reduce((s, c) => s + c, 0);
    if (n === 0) return null;
    const sum = counts.reduce((s, c, i) => s + c * (i - 2), 0);
    return sum / n;
};

const fmt = (v: number | null) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(2)}`);

export default function CompassStats({ stats, personas }: Props) {
    const [scope, setScope] = useState('all');
    const [groupId, setGroupId] = useState(QUESTION_GROUPS[0].id);
    const [questionKey, setQuestionKey] = useState(QUESTION_GROUPS[0].questions[0].key);

    const group = QUESTION_GROUPS.find((g) => g.id === groupId) ?? QUESTION_GROUPS[0];
    const question = group.questions.find((q) => q.key === questionKey) ?? group.questions[0];

    const personaName = (id: string) => personas.find((p) => p.id === id)?.name ?? id;

    const spectrumTotal = useMemo(
        () => stats.bySpectrum.reduce((s, x) => s + x.count, 0),
        [stats.bySpectrum]
    );
    const maxSpectrum = Math.max(1, ...stats.bySpectrum.map((s) => s.count));

    const qScope = stats.questions[question.key]?.[scope] ?? stats.questions[question.key]?.all;
    const qMean = meanOf(qScope?.counts);
    const qAll = stats.questions[question.key]?.all;
    const qAllMean = meanOf(qAll?.counts);
    const showQuestion = (qScope?.n ?? 0) >= MIN_RESPONSES;

    const axisForScope = stats.axisAverages[scope] ?? stats.axisAverages.all;

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
                            {/* General counts */}
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

                            {/* Scope selector */}
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

                            {/* Spectrum distribution */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base">توزّع الأنماط</CardTitle>
                                    <CardDescription className="text-xs">
                                        {spectrumTotal} مشاركة مصنّفة على الأنماط
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {stats.bySpectrum.map((s) => (
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

                            {/* Axis averages */}
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

                            {/* Question average */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <ListChecks className="h-4 w-4 text-primary" />
                                        متوسط الإجابة على سؤال
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        اختر محوراً ثم سؤالاً لعرض متوسط إجابات المشاركين عليه.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <label className="text-xs text-muted-foreground">المحور</label>
                                            <Select
                                                value={groupId}
                                                onValueChange={(v) => {
                                                    setGroupId(v);
                                                    const g = QUESTION_GROUPS.find((x) => x.id === v);
                                                    if (g) setQuestionKey(g.questions[0].key);
                                                }}
                                                dir="rtl"
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {QUESTION_GROUPS.map((g) => (
                                                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs text-muted-foreground">السؤال</label>
                                            <Select value={questionKey} onValueChange={setQuestionKey} dir="rtl">
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectGroup>
                                                        <SelectLabel>{group.name}</SelectLabel>
                                                        {group.questions.map((q) => (
                                                            <SelectItem key={q.key} value={q.key}>
                                                                {q.text.length > 70 ? `${q.text.slice(0, 70)}…` : q.text}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectGroup>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="rounded-lg border border-border bg-muted/30 p-4">
                                        <p className="text-sm leading-relaxed">{question.text}</p>

                                        {showQuestion && qScope ? (
                                            <>
                                                <div className="mt-4 flex items-end gap-4">
                                                    <div>
                                                        <p className="text-xs text-muted-foreground">متوسط الإجابة ({SCOPES.find((s) => s.id === scope)?.label})</p>
                                                        <p className="text-3xl font-extrabold text-primary tabular-nums">{fmt(qMean)}</p>
                                                    </div>
                                                    <div className="pb-1 text-xs text-muted-foreground">
                                                        <p>عدد الإجابات: {qScope.n}</p>
                                                        {scope !== 'all' && qAllMean != null && (
                                                            <p>المتوسط العام: {fmt(qAllMean)}</p>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Distribution */}
                                                <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-muted">
                                                    {qScope.counts.map((c, i) => {
                                                        const total = qScope.counts.reduce((s, x) => s + x, 0) || 1;
                                                        const color = i < 2 ? 'bg-destructive/70' : i === 2 ? 'bg-muted-foreground/40' : 'bg-primary/70';
                                                        return (
                                                            <div
                                                                key={i}
                                                                className={color}
                                                                style={{ width: `${(c / total) * 100}%` }}
                                                                title={`${OPTION_LABELS[i]}: ${c}`}
                                                            />
                                                        );
                                                    })}
                                                </div>
                                                <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                                                    <span>{OPTION_LABELS[0]}</span>
                                                    <span>{OPTION_LABELS[2]}</span>
                                                    <span>{OPTION_LABELS[4]}</span>
                                                </div>
                                            </>
                                        ) : (
                                            <p className="mt-3 text-sm text-muted-foreground">
                                                لا توجد إجابات كافية لعرض متوسط هذا السؤال بعد.
                                            </p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    )}
                </main>
            </div>
        </MainLayout>
    );
}
