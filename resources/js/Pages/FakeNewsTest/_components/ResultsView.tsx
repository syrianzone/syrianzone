import React, { useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  Landmark,
  Lightbulb,
  Loader2,
  Quote,
  RotateCcw,
  Share2,
  ShieldCheck,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/Components/ui/accordion';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Separator } from '@/Components/ui/separator';
import {
  buildShareText,
  FACT_CHECK_TIPS,
  getHardestClaims,
} from '@/Domain/fakenewstest/claims';
import type { ClaimKind, FakeNewsStats, RoundSummary } from '@/Domain/fakenewstest/types';
import { exportElementAsPng, renderElementAsPngFile } from '@/Lib/exportElementAsPng';
import { notify } from '@/Lib/notify';
import { useThemeId } from '@/Lib/theme';
import { cn } from '@/Lib/utils';
import BdiText from './BdiText';
import FakeNewsShareCard from './FakeNewsShareCard';
import KindBadge from './KindBadge';

interface ResultsViewProps {
  summary: RoundSummary;
  stats: FakeNewsStats | null;
  onPlayAgain: () => void;
}

const KIND_ICONS: Record<ClaimKind, React.ComponentType<{ className?: string }>> = {
  decisions: Landmark,
  economy: TrendingUp,
  quotes: Quote,
  media: ImageIcon,
};

export default function ResultsView({ summary, stats, onPlayAgain }: ResultsViewProps) {
  const themeKey = useThemeId();
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [imageBusy, setImageBusy] = useState(false);

  const hardestClaims = useMemo(() => getHardestClaims(stats, 2), [stats]);

  const handleCopyResult = async () => {
    const text = buildShareText(summary);
    try {
      await navigator.clipboard.writeText(text);
      notify.copy('تم نسخ النتيجة');
    } catch {
      notify.error('تعذّر نسخ النتيجة، حاول مجدداً');
    }
  };

  const handleDownloadCard = async () => {
    if (!shareCardRef.current) return;
    setImageBusy(true);
    const filename = `syrianzone-fakenews-${summary.score}-of-${summary.total}.png`;
    try {
      const file = await renderElementAsPngFile(shareCardRef.current, filename);
      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };
      if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
        try {
          await nav.share({
            files: [file],
            title: 'هل تميّزها؟ نسخة سوريا',
            text: buildShareText(summary),
          });
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return;
        }
      }
      await exportElementAsPng(file, filename);
      notify.success('تم تحميل بطاقة النتيجة');
    } catch {
      notify.error('تعذّر إنشاء بطاقة النتيجة، حاول مرة أخرى');
    } finally {
      setImageBusy(false);
    }
  };

  const userPct = Math.round((summary.score / summary.total) * 100);
  const avgPct =
    stats && stats.average_score !== null
      ? Math.round((stats.average_score / summary.total) * 100)
      : null;

  return (
    <section
      className="mx-auto max-w-lg px-4 py-5 sm:py-8 space-y-4"
      aria-labelledby="fakenewstest-results-title"
    >
      {/* Completed 12-segment story bar */}
      <div
        className="flex items-center gap-1"
        role="img"
        aria-label={`أصبت في ${summary.score} من ${summary.total} بطاقات`}
      >
        {summary.orderedResults.map((item) => (
          <span
            key={item.claim.id}
            className={cn(
              'h-1.5 flex-1 rounded-full',
              item.correct ? 'bg-emerald-500' : 'bg-destructive',
            )}
          />
        ))}
      </div>

      {/* Hero Result Card (matches CompassResult shadcn style) */}
      <Card className="overflow-hidden">
        <div className="bg-primary/10 px-5 py-6 text-center space-y-2">
          <div className="flex items-baseline justify-center gap-2.5">
            <span dir="ltr" className="text-4xl font-extrabold tracking-tight text-foreground">
              {summary.score}
              <span className="text-xl font-bold text-muted-foreground">/{summary.total}</span>
            </span>
            <Badge variant="secondary" className="font-bold">
              <bdi dir="ltr">{summary.percentage}%</bdi>
            </Badge>
          </div>

          <h1
            id="fakenewstest-results-title"
            className="text-2xl font-extrabold text-foreground"
          >
            {summary.rank.title}
          </h1>

          <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
            {summary.rank.subtitle}
          </p>
        </div>

        <Separator />

        <CardContent className="p-5 space-y-4">
          {/* 12-tile visual strip */}
          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12" aria-hidden="true">
            {summary.orderedResults.map((item) => (
              <div
                key={item.claim.id}
                className={cn(
                  'flex h-8 items-center justify-center rounded-md border',
                  item.correct
                    ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'border-destructive/35 bg-destructive/10 text-destructive',
                )}
              >
                {item.correct ? (
                  <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                ) : (
                  <X className="h-3.5 w-3.5 stroke-[2.5]" />
                )}
              </div>
            ))}
          </div>

          {/* Share & Replay Actions */}
          <div className="space-y-2">
            <Button
              type="button"
              size="lg"
              onClick={handleDownloadCard}
              disabled={imageBusy}
              className="w-full gap-2 font-bold"
            >
              {imageBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Share2 className="h-4 w-4" aria-hidden="true" />
              )}
              <span>مشاركة بطاقة النتيجة</span>
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCopyResult}
                className="gap-2 font-semibold"
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
                <span>نسخ النتيجة</span>
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={onPlayAgain}
                className="gap-2 font-semibold"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                <span>العب مجدّداً</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2x2 Category Breakdown */}
      <div className="grid grid-cols-2 gap-3">
        {summary.byCategory.map((cat) => {
          const Icon = KIND_ICONS[cat.kind];
          return (
            <Card key={cat.kind}>
              <CardContent className="p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span dir="ltr" className="text-xs font-bold tabular-nums text-foreground">
                    {cat.correct}/{cat.total}
                  </span>
                </div>
                <p className="text-xs font-semibold text-foreground">{cat.label}</p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-300',
                      cat.accuracyPct >= 67
                        ? 'bg-emerald-500'
                        : cat.accuracyPct >= 34
                          ? 'bg-primary'
                          : 'bg-destructive',
                    )}
                    style={{ width: `${cat.accuracyPct}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Anonymous Community Comparison */}
      {stats && stats.total_runs > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3 pt-4 px-5">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" aria-hidden="true" />
              <span>كيف أجاب الآخرون</span>
            </CardTitle>
            <Badge variant="secondary" className="text-[11px] font-semibold">
              <bdi dir="ltr">{stats.total_runs.toLocaleString('en-US')}</bdi>&nbsp;جولة مجهولة
            </Badge>
          </CardHeader>

          <CardContent className="space-y-4 px-5 pb-5">
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-foreground">نتيجتك</span>
                  <span dir="ltr" className="tabular-nums text-foreground">
                    {summary.score}/{summary.total}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${userPct}%` }} />
                </div>
              </div>

              {stats.average_score !== null && avgPct !== null && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">متوسّط المشاركين</span>
                    <span dir="ltr" className="tabular-nums text-muted-foreground">
                      {stats.average_score.toFixed(1)}/{summary.total}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-foreground/30"
                      style={{ width: `${avgPct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {hardestClaims.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">الأكثر خداعاً للمشاركين</p>
                  {hardestClaims.map(({ claim, wrongPct }) => (
                    <div
                      key={claim.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3"
                    >
                      <p className="text-xs font-medium text-foreground leading-relaxed">
                        <BdiText text={claim.text} />
                      </p>
                      <Badge
                        variant="destructive"
                        className="shrink-0 gap-1 text-[11px] font-bold whitespace-nowrap"
                      >
                        <span>أخطأ</span>
                        <bdi dir="ltr">{wrongPct}%</bdi>
                      </Badge>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* shadcn Accordion for Full Review & Fact-Checking Habits */}
      <Accordion type="multiple">
        <AccordionItem value="review">
          <AccordionTrigger className="px-4 py-3.5">
            <span>
              مراجعة البطاقات (<bdi dir="ltr">{summary.orderedResults.length}</bdi>)
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 pt-3 space-y-3">
            {summary.orderedResults.map((item) => {
              const sources = [
                item.claim.source,
                ...(item.claim.source2 ? [item.claim.source2] : []),
              ];
              return (
                <article
                  key={item.claim.id}
                  className="rounded-lg border border-border bg-muted/25 p-3.5 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex h-5 w-5 items-center justify-center rounded-full',
                          item.correct
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : 'bg-destructive/15 text-destructive',
                        )}
                        aria-hidden="true"
                      >
                        {item.correct ? (
                          <Check className="h-3 w-3 stroke-[2.5]" />
                        ) : (
                          <X className="h-3 w-3 stroke-[2.5]" />
                        )}
                      </span>
                      <KindBadge kind={item.claim.kind} />
                    </div>

                    <Badge
                      variant={item.claim.answer ? 'secondary' : 'destructive'}
                      className={cn(
                        'text-[11px] font-bold',
                        item.claim.answer &&
                          'border-emerald-500/30 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200',
                      )}
                    >
                      {item.claim.label}
                    </Badge>
                  </div>

                  <p className="text-sm font-bold text-foreground leading-relaxed">
                    <BdiText text={item.claim.text} />
                  </p>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <BdiText text={item.claim.explain} />
                  </p>

                  <div className="flex flex-wrap gap-2 pt-0.5">
                    {sources.map((src) => (
                      <a
                        key={src.url}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline underline-offset-4"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span>
                          <BdiText text={src.title} />
                        </span>
                      </a>
                    ))}
                  </div>
                </article>
              );
            })}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="tips">
          <AccordionTrigger className="px-4 py-3.5">
            <Lightbulb className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
            <span>عادات سريعة للتحقّق</span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 pt-3">
            <ul className="space-y-2.5 text-xs sm:text-sm text-foreground/90 leading-relaxed">
              {FACT_CHECK_TIPS.map((tip, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <Badge variant="secondary" className="mt-0.5 h-5 w-5 shrink-0 justify-center p-0 text-[11px]">
                    <bdi dir="ltr">{i + 1}</bdi>
                  </Badge>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Credit */}
      <footer className="px-2 pb-2 text-center text-xs text-muted-foreground leading-relaxed">
        <span className="inline-flex items-center gap-1 align-middle text-primary me-1">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        تستند غالبية البطاقات إلى مواد تحقّق عبر{' '}
        <a
          href="https://www.verify-sy.com/ar"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-primary hover:underline underline-offset-4"
        >
          منصة تأكد
        </a>{' '}
        ومصادر رسمية. الإحصاءات مجهولة تماماً.
      </footer>

      {/* Off-screen 360x640 story card captured by html2canvas-pro */}
      <div
        aria-hidden="true"
        style={{ position: 'fixed', top: 0, left: -10000, pointerEvents: 'none', zIndex: -1 }}
      >
        <FakeNewsShareCard
          ref={shareCardRef}
          summary={summary}
          stats={stats}
          themeKey={themeKey}
        />
      </div>
    </section>
  );
}
