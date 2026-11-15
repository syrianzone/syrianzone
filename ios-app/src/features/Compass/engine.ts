import type { AnswerMap, AxisId, AxisScores, Figure, MatchedFigure, QuizVersion, Spectrum } from '../../../../resources/js/Domain/compass/types';
interface CompassEngine {
  axisKey(axis: AxisId, index: number): string;
  alignKey(index: number): string;
  activeQuestions(axis: AxisId, version: QuizVersion): { q: { text: string; effect: 1 | -1; tier: number; weight: number }; i: number }[];
  activeAlignQuestions(version: QuizVersion): { q: { text: string; target: string; tier: number; weight: number }; i: number }[];
  versionTotals(version: QuizVersion): { numeric: number; align: number; total: number };
  computeScores(answers: AnswerMap, version: QuizVersion): AxisScores;
  computeConsistency(answers: AnswerMap, version: QuizVersion): number;
  matchFigures(scores: AxisScores['axes'], alignment: AxisScores['align'], figures: Figure[]): { matches: MatchedFigure[]; hasStrongMatch: boolean };
  matchSpectrum(scores: AxisScores['axes'], personas: Spectrum[]): { spectrum: Spectrum | null; score: number };
}
// PORT NOTE: Typed require reuses the unchanged source algorithm without imposing native array-index settings on its source project.
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const engine = require('../../../../resources/js/Domain/compass/engine') as CompassEngine;
// PORT STATUS: source resources/js/Domain/compass/engine.ts; confidence high; todos 0.
