import React from 'react';
import { Check, Play, RotateCcw, X } from 'lucide-react';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import { FAKE_NEWS_CLAIMS } from '@/Domain/fakenewstest/claims';
import type { FakeNewsStats } from '@/Domain/fakenewstest/types';

interface OpeningViewProps {
  stats: FakeNewsStats | null;
  resumableCount: number | null;
  onStart: () => void;
  onResume: () => void;
}

export default function OpeningView({
  stats,
  resumableCount,
  onStart,
  onResume,
}: OpeningViewProps) {
  const totalClaims = FAKE_NEWS_CLAIMS.length;

  return (
    <section
      className="mx-auto flex min-h-[calc(100svh-var(--sz-navbar-h,4rem)-2rem)] max-w-md flex-col items-center justify-center px-4 py-8 text-center"
      aria-labelledby="fakenewstest-hero-title"
    >
      {/* Clean stacked shadcn Cards previewing the swipe mechanic */}
      <div className="relative mb-8 flex h-40 w-60 items-center justify-center select-none" aria-hidden="true">
        <Card className="absolute h-32 w-48 -rotate-6 bg-muted/60" />
        <Card className="absolute h-32 w-48 rotate-6 bg-card" />
        <Card className="relative z-10 flex h-32 w-48 flex-col items-center justify-center gap-2.5 p-4 shadow-md">
          <div className="h-2 w-24 rounded-full bg-muted" />
          <div className="h-2 w-32 rounded-full bg-muted-foreground/20" />
          <div className="h-2 w-20 rounded-full bg-muted-foreground/15" />
          <Badge variant="secondary" className="mt-1 text-[11px] font-semibold">
            <bdi dir="ltr">{totalClaims}</bdi>&nbsp;بطاقة
          </Badge>
        </Card>

        <div className="absolute -end-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-destructive/40 bg-background text-destructive shadow-sm">
          <X className="h-5 w-5" />
        </div>
        <div className="absolute -start-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-emerald-500/40 bg-background text-emerald-600 dark:text-emerald-400 shadow-sm">
          <Check className="h-5 w-5" />
        </div>
      </div>

      <Badge variant="secondary" className="mb-3">
        نسخة سوريا
      </Badge>

      <h1
        id="fakenewstest-hero-title"
        className="text-3xl font-extrabold tracking-tight text-foreground"
      >
        هل تميّزها؟
      </h1>

      <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
        أخبار حقيقية تبدو غريبة، وشائعات تبدو رسمية. اسحب البطاقة يميناً للصحيح ويساراً للخطأ، واكتشف الحقيقة فوراً.
      </p>

      <Card className="mt-7 w-full">
        <CardContent className="p-4 space-y-2.5">
          <Button size="lg" onClick={onStart} className="w-full gap-2 font-bold">
            <Play className="h-4 w-4 fill-current" aria-hidden="true" />
            <span>{resumableCount ? 'جولة جديدة' : 'ابدأ الاختبار'}</span>
          </Button>

          {resumableCount !== null && resumableCount > 0 && (
            <Button
              size="lg"
              variant="outline"
              onClick={onResume}
              className="w-full gap-2 font-semibold"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span>
                أكمل الجولة السابقة (<bdi dir="ltr">{resumableCount}/{totalClaims}</bdi>)
              </span>
            </Button>
          )}
        </CardContent>
      </Card>

      <p className="mt-5 text-xs text-muted-foreground">
        {stats && stats.total_runs > 0 ? (
          <>
            <bdi dir="ltr" className="font-semibold text-foreground">
              {stats.total_runs.toLocaleString('en-US')}
            </bdi>{' '}
            جولة
            {stats.average_score !== null && (
              <>
                {' '}· المتوسّط{' '}
                <bdi dir="ltr" className="font-semibold text-foreground">
                  {stats.average_score.toFixed(1)}/{totalClaims}
                </bdi>
              </>
            )}
          </>
        ) : (
          'موثّق بالمصادر'
        )}
      </p>
    </section>
  );
}
