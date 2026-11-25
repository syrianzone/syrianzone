import rawClaims from '../../../data/fake-news-claims.json';
import type {
  AnswerRecord,
  CategoryStat,
  ClaimCommunitySplit,
  ClaimKind,
  ClaimOutcomeStat,
  FakeNewsClaim,
  FakeNewsStats,
  HardestClaimItem,
  OrderedClaimResult,
  RankTier,
  RoundSummary,
  SavedRunState,
} from './types';

export const FAKE_NEWS_CLAIMS: readonly FakeNewsClaim[] = rawClaims as FakeNewsClaim[];

export const ROUND_SIZE = 12;

export const CLAIM_KIND_ORDER: readonly ClaimKind[] = [
  'decisions',
  'economy',
  'quotes',
  'media',
];

export const CLAIM_KIND_META: Record<ClaimKind, { label: string; shortLabel: string }> = {
  decisions: {
    label: 'قرارات وخدمات',
    shortLabel: 'قرارات',
  },
  economy: {
    label: 'اقتصاد وأرقام',
    shortLabel: 'اقتصاد',
  },
  quotes: {
    label: 'تصريحات منسوبة',
    shortLabel: 'تصريحات',
  },
  media: {
    label: 'صور ومقاطع',
    shortLabel: 'صور ومقاطع',
  },
};

export const FACT_CHECK_TIPS: readonly string[] = [
  'ابحث عن النص الأصلي للتصريح أو المرسوم قبل مشاركته، فالأرقام كثيراً ما تتغيّر عند النقل.',
  'تحقّق من تاريخ الخبر؛ كثير من الشائعات تعيد تدوير أخبار قديمة أو مسحوبة من وكالاتها.',
  'لا تعتمد على لقطة شاشة وحدها؛ الصور والمستندات يسهل تعديلها أو توليدها بالذكاء الاصطناعي.',
  'انتبه للعناوين التي تثير غضباً أو دهشة سريعة؛ المبالغة العاطفية أبرز علامات التضليل.',
  'قارن الخبر بين مصدرين موثّقين على الأقل، خاصة عند تداول قرارات اقتصادية أو خدمية.',
  'تذكّر أن النقل عن حساب رسمي أو وكالة معروفة لا يمنع الخطأ البشري أو الحاجة للتصحيح لاحقاً.',
];

export const SHARE_URL = 'https://syrian.zone/games/fakenews';

const STORAGE_KEY = 'syrianzone.fakenewstest.run.v1';

const CLAIM_MAP = new Map<string, FakeNewsClaim>(
  FAKE_NEWS_CLAIMS.map((claim) => [claim.id, claim]),
);

export function getClaimById(id: string): FakeNewsClaim | undefined {
  return CLAIM_MAP.get(id);
}

function shuffleArray<T>(items: readonly T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function shuffleClaimOrder(
  claims: readonly FakeNewsClaim[] = FAKE_NEWS_CLAIMS,
  rng: () => number = Math.random,
): string[] {
  return shuffleArray(
    claims.map((c) => c.id),
    rng,
  );
}

/**
 * Picks a random balanced round of `roundSize` unique claims from the pool,
 * drawing equally across categories where possible and shuffling the final order.
 */
export function pickRoundClaimOrder(
  claims: readonly FakeNewsClaim[] = FAKE_NEWS_CLAIMS,
  roundSize: number = ROUND_SIZE,
  rng: () => number = Math.random,
): string[] {
  const targetSize = Math.min(roundSize, claims.length);
  if (targetSize <= 0) return [];

  const perKind = Math.floor(targetSize / CLAIM_KIND_ORDER.length);
  const picked: string[] = [];
  const pickedSet = new Set<string>();

  for (const kind of CLAIM_KIND_ORDER) {
    const bucket = shuffleArray(
      claims.filter((c) => c.kind === kind),
      rng,
    );
    for (const claim of bucket.slice(0, perKind)) {
      picked.push(claim.id);
      pickedSet.add(claim.id);
    }
  }

  if (picked.length < targetSize) {
    const remaining = shuffleArray(
      claims.filter((c) => !pickedSet.has(c.id)),
      rng,
    );
    for (const claim of remaining.slice(0, targetSize - picked.length)) {
      picked.push(claim.id);
      pickedSet.add(claim.id);
    }
  }

  return shuffleArray(picked, rng);
}

export function getRankTier(score: number, total: number): RankTier {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  if (pct >= 90) {
    return {
      id: 'radar',
      title: 'رادار حقائق',
      subtitle: 'تميّز الخبر الموثّق عن الشائعة بدقّة عالية حتى في التفاصيل الدقيقة.',
    };
  }
  if (pct >= 75) {
    return {
      id: 'sharp-eye',
      title: 'عين فاحصة',
      subtitle: 'أداء قوي؛ تلتقط معظم فخاخ التضليل بسهولة ولا تنخدع بالعناوين المضلّلة.',
    };
  }
  if (pct >= 58) {
    return {
      id: 'alert',
      title: 'متيقّظ',
      subtitle: 'تصيب أكثر مما تخطئ، ومع قليل من التريّث في الأرقام والتصريحات تصبح أدق.',
    };
  }
  if (pct >= 40) {
    return {
      id: 'occasionally-fooled',
      title: 'قابل للخداع أحياناً',
      subtitle: 'بعض العناوين المحبوكة نجحت في تمرير المعلومة الخاطئة وسط الأخبار الحقيقية.',
    };
  }
  return {
    id: 'watch-out',
    title: 'احذر من الشائعات',
    subtitle: 'الأخبار الصادمة والمألوفة تخدعنا جميعاً؛ خطوة تحقق سريعة قبل المشاركة تصنع الفارق.',
  };
}

export function computeSummary(
  order: readonly string[],
  answers: readonly AnswerRecord[],
): RoundSummary {
  const answerById = new Map(answers.map((a) => [a.claimId, a]));
  const orderedResults: OrderedClaimResult[] = [];

  for (const id of order) {
    const claim = CLAIM_MAP.get(id);
    const rec = answerById.get(id);
    if (!claim || !rec) continue;
    orderedResults.push({
      claim,
      userAnswer: rec.userAnswer,
      correct: rec.correct,
    });
  }

  const total = orderedResults.length || ROUND_SIZE;
  const score = orderedResults.filter((r) => r.correct).length;
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

  const byCategory: CategoryStat[] = CLAIM_KIND_ORDER.map((kind) => {
    const items = orderedResults.filter((r) => r.claim.kind === kind);
    const catTotal = items.length;
    const catCorrect = items.filter((r) => r.correct).length;
    return {
      kind,
      label: CLAIM_KIND_META[kind].label,
      correct: catCorrect,
      total: catTotal,
      accuracyPct: catTotal > 0 ? Math.round((catCorrect / catTotal) * 100) : 0,
    };
  });

  return {
    score,
    total,
    percentage,
    rank: getRankTier(score, total),
    byCategory,
    orderedResults,
  };
}

export function getClaimCommunitySplit(
  stats: FakeNewsStats | null | undefined,
  claimId: string,
): ClaimCommunitySplit | null {
  const entry = stats?.claims?.[claimId];
  if (!entry) return null;
  const trueCount = Math.max(0, Number(entry.true) || 0);
  const falseCount = Math.max(0, Number(entry.false) || 0);
  const total = trueCount + falseCount;
  if (total === 0) return null;
  const truePct = Math.round((trueCount / total) * 100);
  const falsePct = 100 - truePct;
  return { trueCount, falseCount, total, truePct, falsePct };
}

export function getHardestClaims(
  stats: FakeNewsStats | null | undefined,
  limit = 2,
): HardestClaimItem[] {
  if (!stats?.claims) return [];
  const items: HardestClaimItem[] = [];

  for (const claim of FAKE_NEWS_CLAIMS) {
    const split = getClaimCommunitySplit(stats, claim.id);
    if (!split) continue;
    const wrongCount = claim.answer ? split.falseCount : split.trueCount;
    const wrongPct = Math.round((wrongCount / split.total) * 100);
    items.push({ claim, wrongPct, total: split.total });
  }

  return items
    .sort((a, b) => b.wrongPct - a.wrongPct || b.total - a.total)
    .slice(0, limit);
}

export function getAllClaimOutcomeStats(
  stats: FakeNewsStats | null | undefined,
): ClaimOutcomeStat[] {
  return FAKE_NEWS_CLAIMS.map((claim) => {
    const split = getClaimCommunitySplit(stats, claim.id);
    if (!split) {
      return {
        claim,
        wonCount: 0,
        failedCount: 0,
        total: 0,
        wonPct: 0,
        failedPct: 0,
      };
    }
    const wonCount = claim.answer ? split.trueCount : split.falseCount;
    const failedCount = claim.answer ? split.falseCount : split.trueCount;
    const wonPct = Math.round((wonCount / split.total) * 100);
    const failedPct = 100 - wonPct;
    return {
      claim,
      wonCount,
      failedCount,
      total: split.total,
      wonPct,
      failedPct,
    };
  });
}

export function buildShareText(summary: RoundSummary): string {
  const tiles = summary.orderedResults
    .map((r) => (r.correct ? '🟩' : '🟥'))
    .join('');

  return [
    'هل تميّزها؟ | نسخة سوريا',
    `النتيجة: ${summary.score}/${summary.total} (${summary.percentage}%) - ${summary.rank.title}`,
    tiles,
    `جرّب اختبار الأخبار المضلّلة: ${SHARE_URL}`,
  ].join('\n');
}

export function loadSavedRun(): SavedRunState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedRunState>;
    if (
      !Array.isArray(parsed.order) ||
      parsed.order.length !== ROUND_SIZE ||
      new Set(parsed.order).size !== ROUND_SIZE ||
      !parsed.order.every((id) => typeof id === 'string' && CLAIM_MAP.has(id))
    ) {
      return null;
    }
    if (!Array.isArray(parsed.answers)) return null;
    const validAnswers = parsed.answers.filter(
      (a): a is AnswerRecord =>
        Boolean(a) &&
        typeof a.claimId === 'string' &&
        CLAIM_MAP.has(a.claimId) &&
        typeof a.userAnswer === 'boolean' &&
        typeof a.correct === 'boolean',
    );
    const index = typeof parsed.index === 'number' ? Math.max(0, Math.min(parsed.order.length - 1, parsed.index)) : 0;
    const phase =
      parsed.phase === 'playing' || parsed.phase === 'reveal' || parsed.phase === 'results'
        ? parsed.phase
        : 'playing';

    return {
      order: parsed.order,
      answers: validAnswers,
      index,
      phase,
      resultSubmitted: Boolean(parsed.resultSubmitted),
    };
  } catch {
    return null;
  }
}

export function saveRun(state: SavedRunState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore storage quota or privacy mode errors */
  }
}

export function clearSavedRun(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
