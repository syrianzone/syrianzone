export type ClaimKind = 'decisions' | 'economy' | 'quotes' | 'media';

export interface ClaimSource {
  title: string;
  url: string;
}

export interface FakeNewsClaim {
  id: string;
  kind: ClaimKind;
  text: string;
  answer: boolean;
  label: string;
  date: string;
  explain: string;
  image?: string;
  imageAlt?: string;
  source: ClaimSource;
  source2?: ClaimSource;
}

export interface ClaimStat {
  true: number;
  false: number;
}

export interface FakeNewsStats {
  claims: Record<string, ClaimStat>;
  scores: Record<string, number>;
  total_runs: number;
  average_score: number | null;
}

export interface AnswerRecord {
  claimId: string;
  userAnswer: boolean;
  correct: boolean;
}

export interface SavedRunState {
  order: string[];
  answers: AnswerRecord[];
  index: number;
  phase: 'playing' | 'reveal' | 'results';
  resultSubmitted?: boolean;
}

export interface CategoryStat {
  kind: ClaimKind;
  label: string;
  correct: number;
  total: number;
  accuracyPct: number;
}

export interface RankTier {
  id: string;
  title: string;
  subtitle: string;
}

export interface OrderedClaimResult {
  claim: FakeNewsClaim;
  userAnswer: boolean;
  correct: boolean;
}

export interface RoundSummary {
  score: number;
  total: number;
  percentage: number;
  rank: RankTier;
  byCategory: CategoryStat[];
  orderedResults: OrderedClaimResult[];
}

export interface ClaimCommunitySplit {
  trueCount: number;
  falseCount: number;
  total: number;
  truePct: number;
  falsePct: number;
}

export interface HardestClaimItem {
  claim: FakeNewsClaim;
  wrongPct: number;
  total: number;
}

export interface ClaimOutcomeStat {
  claim: FakeNewsClaim;
  wonCount: number;
  failedCount: number;
  total: number;
  wonPct: number;
  failedPct: number;
}
