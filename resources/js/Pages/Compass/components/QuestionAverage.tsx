import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Components/ui/card';
import {
    Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/Components/ui/select';
import { ListChecks } from 'lucide-react';
import { AXES } from '../data/axes';
import { QUESTIONS } from '../data/questions';
import { ALIGN_QUESTIONS } from '../data/align';
import { axisKey, alignKey } from '../lib/engine';

export interface QuestionScope {
    n: number;
    counts: number[]; // index 0..4 => answer -2..+2
}

interface Props {
    questions: Record<string, Record<string, QuestionScope>>;
    scope: string;
    scopeLabel: string;
}

const OPTION_LABELS = ['أعارض بشدة', 'أعارض', 'محايد', 'أوافق', 'أوافق بشدة'];

/** Below this many responses an average is withheld (privacy + noise). */
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
    return counts.reduce((s, c, i) => s + c * (i - 2), 0) / n;
};

const fmt = (v: number | null) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(2)}`);

/** Average answer to a single question, with its option distribution.
 *  Shared by the public stats page and the admin stats page. */
export default function QuestionAverage({ questions, scope, scopeLabel }: Props) {
    const [groupId, setGroupId] = useState(QUESTION_GROUPS[0].id);
    const [questionKey, setQuestionKey] = useState(QUESTION_GROUPS[0].questions[0].key);

    const group = QUESTION_GROUPS.find((g) => g.id === groupId) ?? QUESTION_GROUPS[0];
    const question = group.questions.find((q) => q.key === questionKey) ?? group.questions[0];

    const qScope = questions[question.key]?.[scope] ?? questions[question.key]?.all;
    const qMean = meanOf(qScope?.counts);
    const qAllMean = meanOf(questions[question.key]?.all?.counts);
    const show = (qScope?.n ?? 0) >= MIN_RESPONSES;

    return (
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

                    {show && qScope ? (
                        <>
                            <div className="mt-4 flex items-end gap-4">
                                <div>
                                    <p className="text-xs text-muted-foreground">متوسط الإجابة ({scopeLabel})</p>
                                    <p className="text-3xl font-extrabold text-primary tabular-nums">{fmt(qMean)}</p>
                                </div>
                                <div className="pb-1 text-xs text-muted-foreground">
                                    <p>عدد الإجابات: {qScope.n}</p>
                                    {scope !== 'all' && qAllMean != null && <p>المتوسط العام: {fmt(qAllMean)}</p>}
                                </div>
                            </div>

                            <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-muted">
                                {qScope.counts.map((c, i) => {
                                    const total = qScope.counts.reduce((s, x) => s + x, 0) || 1;
                                    const color = i < 2 ? 'bg-destructive/70' : i === 2 ? 'bg-muted-foreground/40' : 'bg-primary/70';
                                    return (
                                        <div key={i} className={color} style={{ width: `${(c / total) * 100}%` }} title={`${OPTION_LABELS[i]}: ${c}`} />
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
    );
}
