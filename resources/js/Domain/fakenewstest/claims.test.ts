import { describe, expect, it } from 'vitest';
import {
  buildShareText,
  CLAIM_KIND_ORDER,
  computeSummary,
  FAKE_NEWS_CLAIMS,
  getAllClaimOutcomeStats,
  getClaimCommunitySplit,
  getHardestClaims,
  getRankTier,
  SHARE_URL,
  shuffleClaimOrder,
} from './claims';
import type { AnswerRecord, FakeNewsStats } from './types';

describe('fakenewstest domain', () => {
  it('loads 12 verified Syrian claims with 3 per category', () => {
    expect(FAKE_NEWS_CLAIMS).toHaveLength(12);

    const uniqueIds = new Set(FAKE_NEWS_CLAIMS.map((c) => c.id));
    expect(uniqueIds.size).toBe(12);

    for (const kind of CLAIM_KIND_ORDER) {
      const count = FAKE_NEWS_CLAIMS.filter((c) => c.kind === kind).length;
      expect(count).toBe(3);
    }

    for (const claim of FAKE_NEWS_CLAIMS) {
      expect(claim.text.length).toBeGreaterThan(10);
      expect(claim.explain.length).toBeGreaterThan(10);
      expect(claim.label.length).toBeGreaterThan(0);
      expect(claim.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(claim.source.url).toMatch(/^https?:\/\//);
    }
  });

  it('shuffles claim order preserving all 12 claim ids', () => {
    const order = shuffleClaimOrder(FAKE_NEWS_CLAIMS, () => 0.42);
    expect(order).toHaveLength(12);
    expect(new Set(order).size).toBe(12);
    for (const claim of FAKE_NEWS_CLAIMS) {
      expect(order).toContain(claim.id);
    }
  });

  it('assigns rank tiers across score ranges', () => {
    expect(getRankTier(12, 12).id).toBe('radar');
    expect(getRankTier(11, 12).id).toBe('radar');
    expect(getRankTier(9, 12).id).toBe('sharp-eye');
    expect(getRankTier(7, 12).id).toBe('alert');
    expect(getRankTier(5, 12).id).toBe('occasionally-fooled');
    expect(getRankTier(2, 12).id).toBe('watch-out');
  });

  it('computes round summary and per-category accuracy accurately', () => {
    const order = FAKE_NEWS_CLAIMS.map((c) => c.id);
    // Answer true for every claim: 6 of 12 claims are actually true.
    const answers: AnswerRecord[] = FAKE_NEWS_CLAIMS.map((claim) => ({
      claimId: claim.id,
      userAnswer: true,
      correct: claim.answer === true,
    }));

    const summary = computeSummary(order, answers);
    expect(summary.total).toBe(12);
    expect(summary.score).toBe(6);
    expect(summary.percentage).toBe(50);
    expect(summary.rank.id).toBe('occasionally-fooled');
    expect(summary.orderedResults).toHaveLength(12);
    expect(summary.byCategory).toHaveLength(4);

    const decisions = summary.byCategory.find((c) => c.kind === 'decisions');
    expect(decisions).toMatchObject({ total: 3, correct: 2, accuracyPct: 67 });
    const media = summary.byCategory.find((c) => c.kind === 'media');
    expect(media).toMatchObject({ total: 3, correct: 1, accuracyPct: 33 });
  });

  it('builds share text with score, 12 emoji tiles, rank title, and URL', () => {
    const order = FAKE_NEWS_CLAIMS.map((c) => c.id);
    const answers: AnswerRecord[] = FAKE_NEWS_CLAIMS.map((claim, idx) => ({
      claimId: claim.id,
      userAnswer: idx < 10 ? claim.answer : !claim.answer,
      correct: idx < 10,
    }));

    const summary = computeSummary(order, answers);
    const text = buildShareText(summary);

    expect(text).toContain('10/12');
    expect(text).toContain('83%');
    expect(text).toContain(summary.rank.title);
    expect(text).toContain('🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟥🟥');
    expect(text).toContain(SHARE_URL);
  });

  it('computes community split and hardest claims from stats', () => {
    const stats: FakeNewsStats = {
      claims: {
        s01: { true: 3, false: 7 }, // answer=true -> 70% wrong
        s18: { true: 8, false: 2 }, // answer=false -> 80% wrong
        s08: { true: 9, false: 1 }, // answer=true -> 10% wrong
      },
      scores: { '8': 5 },
      total_runs: 10,
      average_score: 7.4,
    };

    const split = getClaimCommunitySplit(stats, 's01');
    expect(split).toEqual({
      trueCount: 3,
      falseCount: 7,
      total: 10,
      truePct: 30,
      falsePct: 70,
    });
    expect(getClaimCommunitySplit(stats, 'missing')).toBeNull();

    const hardest = getHardestClaims(stats, 2);
    expect(hardest).toHaveLength(2);
    expect(hardest[0].claim.id).toBe('s18');
    expect(hardest[0].wrongPct).toBe(80);
    expect(hardest[1].claim.id).toBe('s01');
    expect(hardest[1].wrongPct).toBe(70);

    const outcomes = getAllClaimOutcomeStats(stats);
    expect(outcomes).toHaveLength(12);
    expect(outcomes.find((o) => o.claim.id === 's01')).toMatchObject({
      wonCount: 3,
      failedCount: 7,
      total: 10,
      wonPct: 30,
      failedPct: 70,
    });
    expect(outcomes.find((o) => o.claim.id === 's18')).toMatchObject({
      wonCount: 2,
      failedCount: 8,
      total: 10,
      wonPct: 20,
      failedPct: 80,
    });
    expect(outcomes.find((o) => o.claim.id === 's02')).toMatchObject({
      wonCount: 0,
      failedCount: 0,
      total: 0,
      wonPct: 0,
      failedPct: 0,
    });
  });
});
