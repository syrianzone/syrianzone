export type AxisId =
  | 'auth_lib'
  | 'rel_sec'
  | 'soc_cap'
  | 'nat_glob'
  | 'mil_pac'
  | 'ret_rec'
  | 'central_federal'
  | 'identity_civic'
  | 'ris_communal'
  | 'women_rights'
  | 'sect_memory';

export type Category =
  | 'founder'
  | 'baath'
  | 'islam'
  | 'civ'
  | 'kurd'
  | 'minority'
  | 'current';

export type AlignBloc = 'west' | 'gulf' | 'turkish' | 'east' | 'neutral';

export type QuizVersion = 'short' | 'standard' | 'full';

/** Arabic label for each quiz length, wherever a stored result's version is shown. */
export const VERSION_LABEL: Record<QuizVersion, string> = {
  short: 'قصيرة',
  standard: 'قياسية',
  full: 'كاملة',
};

/** The length filter above the statistics: the three versions plus "all". */
export const STATS_SCOPES: { id: string; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'short', label: VERSION_LABEL.short },
  { id: 'standard', label: VERSION_LABEL.standard },
  { id: 'full', label: VERSION_LABEL.full },
];

/** Answer distribution for one question in one scope (index 0..4 ⇒ answer −2..+2). */
export interface QuestionScope {
  n: number;
  counts: number[];
}

/**
 * The anonymous-statistics payload `/compass/stats` and its admin view both
 * render; the admin adds its own counters on top.
 */
export interface CompassStatsPayload {
  total: number;
  byVersion: Record<string, number>;
  bySpectrum: Record<string, { id: string; count: number }[]>;
  axisAverages: Record<string, Partial<Record<AxisId, number | null>>>;
  questions: Record<string, Record<string, QuestionScope>>;
}

/** A single numeric axis. */
export interface Axis {
  id: AxisId;
  name: string;
  left: string;
  right: string;
  desc: string;
}

/** A single statement. `effect`: +1 agreement pushes to the axis `right` pole, −1 to `left`.
 *  `tier`: 1 (short) · 2 (standard) · 3 (full). `weight`: centrality 1–2. */
export interface Question {
  text: string;
  effect: 1 | -1;
  tier: 1 | 2 | 3;
  weight: number;
}

export type QuestionMap = Record<AxisId, Question[]>;

/** Categorical foreign-alignment question. */
export interface AlignQuestion {
  text: string;
  target: AlignBloc;
  tier: 1 | 2 | 3;
  weight: number;
}

/** A scored personality (historical or current). `positions[axis]` ∈ [-1,1] or null (N/A). */
export interface Figure {
  name: string;
  category: Category;
  align: string; // one or two blocs joined by '/'
  positions: Partial<Record<AxisId, number | null>>;
  image?: string; // local asset path; omitted → symbolic avatar
  credit?: string;
  license?: string;
  sourceUrl?: string;
}

/** Per-axis window. When present, a run must fall inside it to keep this persona. */
export type PersonaRange = { min: number; max: number };

/** A spectrum (umbrella ideological label) with stance copy + historical factoid. */
export interface Spectrum {
  id: string;
  name: string;
  short: string; // ~30 words for the card
  stances: string[]; // it/its owner wants
  factoid: string; // ~100 words, region-free, neutral past tense
  center: Partial<Record<AxisId, number>>; // target vector for matching
  icon: string; // lucide icon name (rendered via SPECTRUM_ICONS)
  /** Optional per-axis windows; a run outside any set window is excluded. */
  ranges?: Partial<Record<AxisId, PersonaRange>>;
}

/** Per-run answers keyed by `axis#index` (numeric) or `align#index` (categorical). */
export type AnswerMap = Record<string, number>;

/** Computed axis scores + alignment tally. */
export interface AxisScores {
  axes: Partial<Record<AxisId, number | null>>;
  align: Record<AlignBloc, number>;
}

/** One stored result (local or account). */
export interface CompassResult {
  id?: number | string;
  version: QuizVersion;
  scores: Partial<Record<AxisId, number | null>>;
  align: Record<AlignBloc, number>;
  answers: AnswerMap;
  topFigure: string | null;
  topScore: number | null;
  spectrum: string | null;
  consistency: number; // 0..1, higher = more consistent
  answered: number;
  createdAt: string;
  /** True once saved to the account (server row exists). */
  savedToAccount?: boolean;
  /** Whether the run was submitted anonymously for statistics. */
  statsConsent?: boolean;
}

export interface MatchedFigure {
  figure: Figure;
  score: number;
  distance: number;
  distinctiveness: number;
}
