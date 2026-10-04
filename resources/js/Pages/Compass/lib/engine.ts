// Compass scoring + matching engine.
// Ported from the study prototype (study/compass-update/axes-render.html).
//
// Two ideas:
//  1) Axis scoring is WEIGHTED and VERSION-AWARE: score = Σ(answer·effect·weight) / (2·Σweight).
//  2) Matching uses WHITENED (Mahalanobis) distance so correlated axes don't triple-count the
//     same belief. A presentation scale maps distance → 0..1 similarity.
import { AXES } from '../data/axes';
import { QUESTIONS } from '../data/questions';
import { ALIGN_QUESTIONS } from '../data/align';
import { FIGURES } from '../data/figures';
import { SPECTRA } from '../data/spectra';
import type {
  AnswerMap,
  AxisId,
  AxisScores,
  AlignBloc,
  Figure,
  MatchedFigure,
  QuizVersion,
} from '../data/types';

export const AXIS_IDS = AXES.map((a) => a.id);
const BLOCS: AlignBloc[] = ['west', 'gulf', 'turkish', 'east', 'neutral'];

export function axisKey(axis: AxisId, i: number) {
  return `${axis}#${i}`;
}
export function alignKey(i: number) {
  return `align#${i}`;
}

export function tierMax(version: QuizVersion): number {
  return version === 'short' ? 1 : version === 'standard' ? 2 : 3;
}

/** Questions visible in a version for one axis, keeping their original index (stable keys). */
export function activeQuestions(axis: AxisId, version: QuizVersion) {
  const max = tierMax(version);
  return (QUESTIONS[axis] || [])
    .map((q, i) => ({ q, i }))
    .filter((o) => o.q.tier <= max);
}
export function activeAlignQuestions(version: QuizVersion) {
  const max = tierMax(version);
  return ALIGN_QUESTIONS.map((q, i) => ({ q, i })).filter((o) => o.q.tier <= max);
}

export function versionTotals(version: QuizVersion) {
  const numeric = AXIS_IDS.reduce((s, a) => s + activeQuestions(a, version).length, 0);
  const align = activeAlignQuestions(version).length;
  return { numeric, align, total: numeric + align };
}

/** Compute axis scores + alignment tally from answers for a given version. */
export function computeScores(answers: AnswerMap, version: QuizVersion): AxisScores {
  const axes: Partial<Record<AxisId, number | null>> = {};
  for (const id of AXIS_IDS) {
    let num = 0;
    let den = 0;
    for (const { q, i } of activeQuestions(id, version)) {
      const v = answers[axisKey(id, i)];
      if (v === undefined) continue;
      num += v * q.effect * q.weight;
      den += 2 * q.weight;
    }
    axes[id] = den ? num / den : null;
  }
  const align: Record<AlignBloc, number> = { west: 0, gulf: 0, turkish: 0, east: 0, neutral: 0 };
  for (const { q, i } of activeAlignQuestions(version)) {
    const v = answers[alignKey(i)];
    if (v === undefined) continue;
    align[q.target] += v * q.weight;
  }
  return { axes, align };
}

/** Consistency 0..1: penalizes axes where the respondent picked both poles strongly.
 *  High = coherent. Uses the answered questions per axis/version. */
export function computeConsistency(answers: AnswerMap, version: QuizVersion): number {
  let consistent = 0;
  let total = 0;
  for (const id of AXIS_IDS) {
    let pos = 0;
    let neg = 0;
    for (const { q, i } of activeQuestions(id, version)) {
      const v = answers[axisKey(id, i)];
      if (v === undefined) continue;
      // agreement toward the +pole counts positive, toward the −pole negative
      const contribution = v * q.effect;
      if (contribution > 0) pos += contribution;
      else neg += -contribution;
    }
    const sum = pos + neg;
    if (sum === 0) continue;
    // 1 when fully one-sided, →0 when split evenly between both poles
    consistent += Math.abs(pos - neg) / sum;
    total += 1;
  }
  return total ? consistent / total : 1;
}

// ---- whitening (built once) ----
interface Whitener {
  axes: AxisId[];
  mean: Partial<Record<AxisId, number>>;
  sd: Partial<Record<AxisId, number>>;
  inv: number[][];
  scale: number;
  distinct: Record<string, number>;
}

let _whitener: Whitener | null = null;

function invertMatrix(C: number[][], ridge: number): number[][] {
  const n = C.length;
  const A = C.map((r, i) => r.map((v, j) => v + (i === j ? ridge : 0)));
  const I = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let c = 0; c < n; c++) {
    let p = Math.abs(A[c][c]);
    let piv = c;
    for (let r = c + 1; r < n; r++) {
      if (Math.abs(A[r][c]) > p) {
        p = Math.abs(A[r][c]);
        piv = r;
      }
    }
    if (piv !== c) {
      [A[c], A[piv]] = [A[piv], A[c]];
      [I[c], I[piv]] = [I[piv], I[c]];
    }
    const pv = A[c][c] || 1e-9;
    for (let j = 0; j < n; j++) {
      A[c][j] /= pv;
      I[c][j] /= pv;
    }
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = A[r][c];
      for (let j = 0; j < n; j++) {
        A[r][j] -= f * A[c][j];
        I[r][j] -= f * I[c][j];
      }
    }
  }
  return I;
}

export function buildWhitener(): Whitener {
  if (_whitener) return _whitener;
  const axes = AXIS_IDS;
  const D = axes.length;
  const N = FIGURES.length;
  const mean: Partial<Record<AxisId, number>> = {};
  const sd: Partial<Record<AxisId, number>> = {};
  for (const a of axes) {
    const vals = FIGURES.map((f) => f.positions[a]).filter((v): v is number => v != null);
    mean[a] = vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : 0;
    const m = mean[a] as number;
    sd[a] = Math.sqrt(vals.reduce((s, x) => s + (x - m) ** 2, 0) / vals.length) || 1;
  }
  const M = FIGURES.map((f) => axes.map((a) => (f.positions[a] == null ? 0 : ((f.positions[a] as number) - (mean[a] as number)) / (sd[a] as number))));
  const C = Array.from({ length: D }, () => new Array(D).fill(0));
  for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) {
    let s = 0;
    for (let k = 0; k < N; k++) s += M[k][i] * M[k][j];
    C[i][j] = s / N;
  }
  const inv = invertMatrix(C, 0.15);
  const maha = (i: number, j: number) => {
    const d = axes.map((_, k) => M[i][k] - M[j][k]);
    let q = 0;
    for (let a = 0; a < D; a++) {
      let r = 0;
      for (let b = 0; b < D; b++) r += inv[a][b] * d[b];
      q += d[a] * r;
    }
    return Math.sqrt(Math.max(0, q));
  };
  let sum = 0;
  let n = 0;
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
    sum += maha(i, j);
    n++;
  }
  const avgPair = n ? sum / n : 3.7;
  // Divisor calibrated so a coherent match reads ~65–75% while a random/incoherent
  // answer set (which averages toward the centre) does not clear the 50% threshold.
  const scale = avgPair / 1.05;
  const distinct: Record<string, number> = {};
  for (const f of FIGURES) {
    let s = 0;
    let c = 0;
    for (const a of axes) {
      const v = f.positions[a];
      if (v == null) continue;
      s += Math.abs((v - (mean[a] as number)) / (sd[a] as number));
      c++;
    }
    distinct[f.name] = c ? s / c : 0;
  }
  _whitener = { axes, mean, sd, inv, scale, distinct };
  return _whitener;
}

export interface MatchOptions {
  extremesOnly?: boolean;
  /** minimum similarity to keep; others still returned but flagged (50% confidence threshold). */
}

const THRESHOLD = 0.5;

/** Match a user's axis scores against the supplied roster.
 *
 *  The whitening reference (`buildWhitener`) stays pinned to the compiled
 *  FIGURES distribution so spectrum matching and the similarity scale are
 *  stable regardless of which characters an operator has enabled; only the
 *  candidate list is dynamic. */
export function matchFigures(
  scores: Partial<Record<AxisId, number | null>>,
  align: Record<AlignBloc, number>,
  figures: Figure[],
  opts: MatchOptions = {}
): { matches: MatchedFigure[]; hasStrongMatch: boolean } {
  const W = buildWhitener();
  const D = W.axes.length;
  const hasAny = W.axes.some((a) => scores[a] != null);
  if (!hasAny || figures.length === 0) return { matches: [], hasStrongMatch: false };

  const u = W.axes.map((id) => (scores[id] == null ? 0 : ((scores[id] as number) - (W.mean[id] as number)) / (W.sd[id] as number)));

  // dominant alignment bloc
  const blocKeys: AlignBloc[] = ['west', 'gulf', 'turkish', 'east'];
  let userBloc: AlignBloc | null = null;
  let best = -Infinity;
  for (const k of blocKeys) if ((align[k] ?? 0) > best) { best = align[k] ?? 0; userBloc = k; }
  const alignAnswered = blocKeys.reduce((s, k) => s + Math.max(0, align[k] ?? 0), 0) > 0;
  const BLOC_DIST: Record<string, Record<string, number>> = {
    west: { west: 0, gulf: 0.5, turkish: 0.8, east: 1 },
    gulf: { west: 0.5, gulf: 0, turkish: 0.4, east: 0.8 },
    turkish: { west: 0.8, gulf: 0.4, turkish: 0, east: 0.7 },
    east: { west: 1, gulf: 0.8, turkish: 0.7, east: 0 },
  };

  const results: MatchedFigure[] = figures.map((f) => {
    const x = W.axes.map((id) => (f.positions[id] == null ? 0 : ((f.positions[id] as number) - (W.mean[id] as number)) / (W.sd[id] as number)));
    const d = W.axes.map((_, i) => x[i] - u[i]);
    let q = 0;
    for (let a = 0; a < D; a++) {
      let r = 0;
      for (let b = 0; b < D; b++) r += W.inv[a][b] * d[b];
      q += d[a] * r;
    }
    let maha = Math.sqrt(Math.max(0, q));
    if (alignAnswered && userBloc) {
      const fBlocs = f.align.split('/').map((s) => s.trim()).filter(Boolean);
      let minD = 1;
      for (const k of blocKeys) if (fBlocs.includes(k)) minD = Math.min(minD, BLOC_DIST[userBloc][k]);
      const wA = 1.2;
      const dA = minD * 1.4; // scale bloc distance like ~one standardized axis
      q += wA * dA * dA;
      maha = Math.sqrt(q);
    }
    let sim = Math.max(0, 1 - maha / W.scale);
    sim = Math.pow(sim, 1.05);
    if (opts.extremesOnly) {
      const disc = W.distinct[f.name] || 0;
      const penalty = Math.min(0.35, Math.max(0, 0.62 - disc) * 0.9);
      sim = sim * (1 - penalty);
    }
    return { figure: f, score: sim, distance: maha, distinctiveness: W.distinct[f.name] || 0 };
  });

  results.sort((a, b) => b.score - a.score);
  return { matches: results, hasStrongMatch: (results[0]?.score ?? 0) >= THRESHOLD };
}

export { THRESHOLD as MATCH_THRESHOLD };

/** Match the user's axis scores to a spectrum (umbrella label). Uses the same whitened space. */
export function matchSpectrum(scores: Partial<Record<AxisId, number | null>>) {
  const W = buildWhitener();
  const D = W.axes.length;
  if (!W.axes.some((a) => scores[a] != null)) return { spectrum: null, score: 0 };
  const u = W.axes.map((id) => (scores[id] == null ? 0 : ((scores[id] as number) - (W.mean[id] as number)) / (W.sd[id] as number)));
  let best = { spectrum: SPECTRA[0], score: -1 };
  for (const sp of SPECTRA) {
    const x = W.axes.map((id) => (sp.center[id] == null ? 0 : ((sp.center[id] as number) - (W.mean[id] as number)) / (W.sd[id] as number)));
    const d = W.axes.map((_, i) => x[i] - u[i]);
    let q = 0;
    for (let a = 0; a < D; a++) {
      let r = 0;
      for (let b = 0; b < D; b++) r += W.inv[a][b] * d[b];
      q += d[a] * r;
    }
    const sim = Math.max(0, Math.pow(Math.max(0, 1 - Math.sqrt(Math.max(0, q)) / W.scale), 1.05));
    if (sim > best.score) best = { spectrum: sp, score: sim };
  }
  return best;
}