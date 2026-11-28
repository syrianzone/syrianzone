import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MainLayout from '@/Layouts/MainLayout';
import { trackEvent } from '@/Lib/analyticsConsent';
import {
  fetchFakeNewsStats,
  recordFakeNewsAnswer,
  recordFakeNewsResult,
} from '@/Domain/fakenewstest/api';
import {
  clearSavedRun,
  computeSummary,
  FAKE_NEWS_CLAIMS,
  getClaimById,
  loadSavedRun,
  pickRoundClaimOrder,
  ROUND_SIZE,
  saveRun,
} from '@/Domain/fakenewstest/claims';
import type {
  AnswerRecord,
  FakeNewsClaim,
  FakeNewsStats,
  SavedRunState,
} from '@/Domain/fakenewstest/types';
import ClaimStatsDialog from './_components/ClaimStatsDialog';
import OpeningView from './_components/OpeningView';
import ResultsView from './_components/ResultsView';
import RevealPanel from './_components/RevealPanel';
import SwipeCardDeck from './_components/SwipeCardDeck';

type ViewPhase = 'opening' | 'playing' | 'reveal' | 'results';

interface FakeNewsTestPageProps {
  initialStats?: FakeNewsStats | null;
}

export default function FakeNewsTestIndex({ initialStats = null }: FakeNewsTestPageProps) {
  const [phase, setPhase] = useState<ViewPhase>('opening');
  const [order, setOrder] = useState<string[]>(() =>
    FAKE_NEWS_CLAIMS.slice(0, ROUND_SIZE).map((c) => c.id),
  );
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [stats, setStats] = useState<FakeNewsStats | null>(initialStats);
  const [savedRun, setSavedRun] = useState<SavedRunState | null>(null);
  const [statsOpen, setStatsOpen] = useState(false);

  const submittedRunRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const viewChangedRef = useRef(false);
  // Always mounted, so screen readers announce the verdict when its text changes.
  const [announcement, setAnnouncement] = useState('');

  // Each phase swaps the whole view and unmounts the control that had focus:
  // move focus to the new view's heading instead of leaving it on <body>.
  useEffect(() => {
    if (!viewChangedRef.current) {
      viewChangedRef.current = true;
      return;
    }
    rootRef.current?.querySelector<HTMLElement>('h1')?.focus();
  }, [phase, index]);

  // Hydrate saved local run after mount so SSR and initial client render match.
  useEffect(() => {
    const saved = loadSavedRun();
    if (
      saved &&
      (saved.phase === 'playing' || saved.phase === 'reveal') &&
      saved.answers.length > 0 &&
      saved.answers.length < ROUND_SIZE
    ) {
      setSavedRun(saved);
    }
  }, []);

  // Fetch anonymous stats if the server did not hydrate them.
  useEffect(() => {
    if (initialStats !== null) return;
    const controller = new AbortController();
    fetchFakeNewsStats(controller.signal)
      .then((fresh) => setStats(fresh))
      .catch(() => {
        /* non-blocking: game remains playable offline */
      });
    return () => controller.abort();
  }, [initialStats]);

  const startFreshRun = useCallback((step: 'start' | 'replay' = 'start') => {
    const freshOrder = pickRoundClaimOrder(FAKE_NEWS_CLAIMS, ROUND_SIZE);
    submittedRunRef.current = false;
    setOrder(freshOrder);
    setIndex(0);
    setAnswers([]);
    setSavedRun(null);
    setPhase('playing');
    clearSavedRun();
    saveRun({
      order: freshOrder,
      answers: [],
      index: 0,
      phase: 'playing',
      resultSubmitted: false,
    });
    trackEvent('fakenews_run_milestone', { step });
  }, []);

  const handleStart = useCallback(() => startFreshRun('start'), [startFreshRun]);
  const handleReplay = useCallback(() => startFreshRun('replay'), [startFreshRun]);

  const resumeSavedRun = useCallback(() => {
    if (!savedRun) return;
    submittedRunRef.current = Boolean(savedRun.resultSubmitted);
    setOrder(savedRun.order);
    setAnswers(savedRun.answers);
    setIndex(savedRun.index);
    setPhase(savedRun.phase);
  }, [savedRun]);

  const activeClaim: FakeNewsClaim | undefined = useMemo(
    () => getClaimById(order[index] ?? ''),
    [order, index],
  );

  const upcomingClaims: FakeNewsClaim[] = useMemo(() => {
    const next: FakeNewsClaim[] = [];
    for (let i = index + 1; i <= index + 2 && i < order.length; i++) {
      const c = getClaimById(order[i]);
      if (c) next.push(c);
    }
    return next;
  }, [order, index]);

  const handleDecide = useCallback(
    (userAnswer: boolean) => {
      if (!activeClaim) return;
      const record: AnswerRecord = {
        claimId: activeClaim.id,
        userAnswer,
        correct: userAnswer === activeClaim.answer,
      };
      const nextAnswers = [
        ...answers.filter((a) => a.claimId !== activeClaim.id),
        record,
      ];
      setAnswers(nextAnswers);
      setAnnouncement(
        `${record.correct ? 'أصبت!' : 'انطلت عليك!'} ${activeClaim.label}`,
      );
      setPhase('reveal');
      saveRun({
        order,
        answers: nextAnswers,
        index,
        phase: 'reveal',
        resultSubmitted: false,
      });

      recordFakeNewsAnswer(activeClaim.id, userAnswer)
        .then((res) => {
          if (res?.stats) setStats(res.stats);
        })
        .catch(() => {
          /* non-blocking: anonymous stat submission failure should not interrupt gameplay */
        });
    },
    [activeClaim, answers, order, index],
  );

  const summary = useMemo(() => computeSummary(order, answers), [order, answers]);

  const handleNext = useCallback(() => {
    setAnnouncement('');
    if (index + 1 < order.length) {
      const nextIndex = index + 1;
      setIndex(nextIndex);
      setPhase('playing');
      saveRun({
        order,
        answers,
        index: nextIndex,
        phase: 'playing',
        resultSubmitted: false,
      });
      return;
    }

    setPhase('results');
    clearSavedRun();
    setSavedRun(null);

    if (!submittedRunRef.current) {
      submittedRunRef.current = true;
      const finalScore = answers.filter((a) => a.correct).length;
      trackEvent('fakenews_run_milestone', { step: 'complete', score: finalScore });
      recordFakeNewsResult(finalScore)
        .then((res) => {
          if (res?.stats) setStats(res.stats);
        })
        .catch(() => {
          /* non-blocking */
        });
    }
  }, [index, order, answers]);

  const latestAnswer = useMemo(
    () => (activeClaim ? answers.find((a) => a.claimId === activeClaim.id) : undefined),
    [activeClaim, answers],
  );

  return (
    <MainLayout>
      {/* Cards are dragged and flown out past the column; clip only at the page edge. */}
      <div ref={rootRef} className="min-h-[calc(100vh-8rem)] overflow-x-clip bg-background text-foreground">
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>

        {phase === 'opening' && (
          <OpeningView
            stats={stats}
            resumableCount={savedRun ? savedRun.answers.length : null}
            onStart={handleStart}
            onResume={resumeSavedRun}
          />
        )}

        {phase === 'playing' && activeClaim && (
          <SwipeCardDeck
            claim={activeClaim}
            upcomingClaims={upcomingClaims}
            answers={answers}
            order={order}
            index={index}
            total={order.length}
            onDecide={handleDecide}
          />
        )}

        {phase === 'reveal' && activeClaim && latestAnswer && (
          <RevealPanel
            claim={activeClaim}
            userAnswer={latestAnswer.userAnswer}
            answers={answers}
            order={order}
            index={index}
            total={order.length}
            onNext={handleNext}
          />
        )}

        {phase === 'results' && (
          <ResultsView
            summary={summary}
            stats={stats}
            onPlayAgain={handleReplay}
            onOpenStats={() => setStatsOpen(true)}
          />
        )}

        <ClaimStatsDialog
          open={statsOpen}
          onOpenChange={setStatsOpen}
          stats={stats}
          onStatsRefresh={setStats}
        />
      </div>
    </MainLayout>
  );
}
