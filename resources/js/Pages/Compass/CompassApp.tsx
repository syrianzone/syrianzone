import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/Components/ui/card';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import { RotateCcw, Timer, Zap, Layers, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import type { AnswerMap, QuizVersion } from './data/types';
import { AXES } from './data/axes';
import { QUESTIONS } from './data/questions';
import { ALIGN_QUESTIONS } from './data/align';
import { activeQuestions, activeAlignQuestions, versionTotals, axisKey, alignKey } from './lib/engine';
import { loadProgress, saveProgress, clearProgress, fetchAccountResults, saveResultToAccount, takePendingAccountSave, setPendingAccountSave, updateLocalResult } from './lib/storage';
import type { CompassResult as SavedResult } from './data/types';
import CompassResult from './CompassResult';
import SavedResults from './components/SavedResults';

const VERSIONS: { id: QuizVersion; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'short', label: 'قصيرة', icon: Zap },
  { id: 'standard', label: 'قياسية', icon: Timer },
  { id: 'full', label: 'كاملة', icon: Layers },
];

interface Props {
  isLoggedIn: boolean;
}

export default function CompassApp({ isLoggedIn }: Props) {
  const [phase, setPhase] = useState<'intro' | 'quiz' | 'result'>('intro');
  const [version, setVersion] = useState<QuizVersion>('standard');
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [index, setIndex] = useState(0);
  const [resumeInfo, setResumeInfo] = useState<{ version: QuizVersion; count: number } | null>(null);
  const [resultToken, setResultToken] = useState(0); // forces result recompute
  const [accountResults, setAccountResults] = useState<SavedResult[]>([]);
  const [viewing, setViewing] = useState<SavedResult | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const refreshAccount = useCallback(() => {
    if (!isLoggedIn) {
      setAccountResults([]);
      return;
    }
    fetchAccountResults()
      .then(setAccountResults)
      .catch(() => setAccountResults([]));
  }, [isLoggedIn]);

  useEffect(() => {
    refreshAccount();
  }, [refreshAccount]);

  // A logged-out user can finish the test, hit "save", and be sent to log in.
  // The run is queued; once we come back authenticated, save it for them.
  useEffect(() => {
    if (!isLoggedIn) return;
    const pending = takePendingAccountSave();
    if (!pending) return;
    saveResultToAccount(pending)
      .then((saved) => {
        updateLocalResult(pending.id, { id: saved?.id ?? pending.id, savedToAccount: true });
        refreshAccount();
      })
      .catch(() => {
        // Put it back so a later visit can retry.
        setPendingAccountSave(pending);
      });
  }, [isLoggedIn, refreshAccount]);

  // ---- build the flattened question list for the chosen version ----
  const items = useMemo(() => {
    const list: { key: string; text: string; axis?: string; target?: string }[] = [];
    for (const a of AXES) {
      for (const { q, i } of activeQuestions(a.id, version)) {
        list.push({ key: axisKey(a.id, i), text: q.text, axis: a.name });
      }
    }
    for (const { q, i } of activeAlignQuestions(version)) {
      list.push({ key: alignKey(i), text: q.text, target: 'التحالف الخارجي' });
    }
    return list;
  }, [version]);

  const totals = useMemo(() => versionTotals(version), [version]);

  // ---- resume offer on mount ----
  useEffect(() => {
    const p = loadProgress();
    if (p && Object.keys(p.answers).length > 0) {
      setResumeInfo({ version: p.version, count: Object.keys(p.answers).length });
    }
  }, []);

  // ---- autosave progress ----
  useEffect(() => {
    if (phase !== 'quiz') return;
    saveProgress({ version, answers, index, updatedAt: new Date().toISOString() });
  }, [phase, version, answers, index]);

  const startFresh = (v: QuizVersion) => {
    clearProgress();
    setVersion(v);
    setAnswers({});
    setIndex(0);
    setResumeInfo(null);
    setPhase('quiz');
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const resume = () => {
    const p = loadProgress();
    if (!p) return;
    setVersion(p.version);
    setAnswers(p.answers);
    setIndex(Math.min(p.index, totals.total - 1));
    setPhase('quiz');
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const answeredCount = useMemo(
    () => items.filter((it) => answers[it.key] !== undefined).length,
    [items, answers]
  );

  const current = items[index];

  const answer = (val: number) => {
    if (!current) return;
    setAnswers((prev) => ({ ...prev, [current.key]: val }));
  };

  const goNext = useCallback(() => {
    if (index < items.length - 1) setIndex((i) => i + 1);
    else {
      setPhase('result');
      setResultToken((t) => t + 1);
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [index, items.length]);

  const goPrev = useCallback(() => {
    if (index > 0) setIndex((i) => i - 1);
  }, [index]);

  const restart = () => {
    clearProgress();
    setPhase('intro');
    setAnswers({});
    setIndex(0);
    setResumeInfo(null);
  };

  // keyboard 1..5
  useEffect(() => {
    if (phase !== 'quiz') return;
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, number> = { '1': -2, '2': -1, '3': 0, '4': 1, '5': 2 };
      if (e.key in map) answer(map[e.key]);
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, index, current, goNext, goPrev]);

  if (viewing) {
    return (
      <div ref={topRef} className="w-full max-w-xl mx-auto">
        <Button variant="ghost" className="mb-2 gap-2" onClick={() => setViewing(null)}>
          <ChevronRight className="w-4 h-4" /> رجوع
        </Button>
        <CompassResult
          answers={viewing.answers}
          version={viewing.version}
          isLoggedIn={isLoggedIn}
          onRestart={() => setViewing(null)}
          readOnly
        />
      </div>
    );
  }

  return (
    <div ref={topRef} className="w-full max-w-xl mx-auto">
      {phase === 'intro' && (
        <>
          <IntroPanel
            resumeInfo={resumeInfo}
            onStart={startFresh}
            onResume={resume}
          />
          <div className="mt-4">
            <SavedResults
              isLoggedIn={isLoggedIn}
              accountResults={accountResults}
              onChanged={refreshAccount}
              onOpen={(r) => {
                setViewing(r);
                topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            />
          </div>
        </>
      )}

      {phase === 'quiz' && current && (
        <QuizPanel
          index={index}
          total={items.length}
          text={current.text}
          label={current.target || current.axis || ''}
          value={answers[current.key]}
          onAnswer={answer}
          onNext={goNext}
          onPrev={goPrev}
          answered={answeredCount}
        />
      )}

      {phase === 'result' && (
        <CompassResult
          key={resultToken}
          answers={answers}
          version={version}
          isLoggedIn={isLoggedIn}
          onRestart={restart}
          onSavedToAccount={refreshAccount}
        />
      )}
    </div>
  );
}

// ---------------- Intro ----------------
function IntroPanel({
  resumeInfo,
  onStart,
  onResume,
}: {
  resumeInfo: { version: QuizVersion; count: number } | null;
  onStart: (v: QuizVersion) => void;
  onResume: () => void;
}) {
  const [selected, setSelected] = useState<QuizVersion>('standard');
  const countFor = (v: QuizVersion) => versionTotals(v).total;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">بوصلة سوريا</CardTitle>
        <CardDescription className="text-base">
          اكتشف موقعك السياسي على أحد عشر محوراً، وأقرب التوجّهات والشخصيات إليك.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {resumeInfo && (
          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <p className="text-sm mb-3">
              لديك اختبار محفوظ ({resumeInfo.count} إجابة).
            </p>
            <div className="flex gap-2">
              <Button onClick={onResume} className="flex-1">تابع من حيث توقّفت</Button>
              <Button variant="outline" onClick={() => onStart('standard')}>ابدأ من جديد</Button>
            </div>
          </div>
        )}

        <div>
          <p className="text-sm font-medium mb-2">اختر طول الاختبار:</p>
          <div className="grid grid-cols-1 gap-2">
            {VERSIONS.map((v) => {
              const Icon = v.icon;
              const active = selected === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => setSelected(v.id)}
                  className={`flex items-center justify-between rounded-lg border p-3 text-right transition ${
                    active ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-primary" />
                    <span className="font-medium">{v.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {v.id === 'short' ? '~3 دقائق' : v.id === 'standard' ? '~7 دقائق' : '~15 دقيقة'}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">{countFor(v.id)} سؤالاً</span>
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          اختبار تعليمي لا يقيس انتساباً طائفياً ولا يُصدر أحكاماً. الحساب يجري في متصفحك،
          ويُحفظ تقدّمك محلياً.
        </p>
      </CardContent>
      <CardFooter>
        <Button size="lg" className="w-full text-lg font-bold" onClick={() => onStart(selected)}>
          ابدأ الاختبار
        </Button>
      </CardFooter>
    </Card>
  );
}

// ---------------- Quiz ----------------
function QuizPanel({
  index,
  total,
  text,
  label,
  value,
  onAnswer,
  onNext,
  onPrev,
  answered,
}: {
  index: number;
  total: number;
  text: string;
  label: string;
  value: number | undefined;
  onAnswer: (v: number) => void;
  onNext: () => void;
  onPrev: () => void;
  answered: number;
}) {
  const progress = ((index + 1) / total) * 100;
  const options = [
    { v: -2, t: 'أعارض بشدة' },
    { v: -1, t: 'أعارض' },
    { v: 0, t: 'محايد' },
    { v: 1, t: 'أوافق' },
    { v: 2, t: 'أوافق بشدة' },
  ];
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>{answered}/{total} مُجاب</span>
          <span>{index + 1} من {total}</span>
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="bg-primary h-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <Badge variant="secondary" className="mt-3 w-fit text-[11px]">{label}</Badge>
        <CardTitle className="text-lg leading-relaxed min-h-[4rem]">{text}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-2">
          {options.map((o) => {
            const active = value === o.v;
            return (
              <button
                key={o.v}
                onClick={() => onAnswer(o.v)}
                className={`flex items-center justify-between rounded-lg border px-4 py-3 text-right transition ${
                  active ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted/50'
                }`}
              >
                <span>{o.t}</span>
                {active && <Check className="w-4 h-4" />}
              </button>
            );
          })}
        </div>
      </CardContent>
      <CardFooter className="flex gap-3">
        <Button variant="outline" onClick={onPrev} disabled={index === 0} aria-label="السابق">
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button onClick={onNext} className="flex-1" disabled={value === undefined}>
          {index === total - 1 ? 'عرض النتيجة' : 'التالي'}
          <ChevronLeft className="w-4 h-4 ms-1" />
        </Button>
      </CardFooter>
    </Card>
  );
}
