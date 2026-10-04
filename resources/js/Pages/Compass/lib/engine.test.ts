import { describe, it, expect } from 'vitest';
import {
  AXIS_IDS,
  activeQuestions,
  versionTotals,
  computeScores,
  computeConsistency,
  matchFigures,
} from './engine';
import { QUESTIONS } from '../data/questions';
import { FIGURES } from '../data/figures';
import { axisKey } from './engine';

/** Fill answers that reproduce a figure's axis score as closely as possible. */
function fillForFigure(name: string, version: 'short' | 'standard' | 'full') {
  const fig = FIGURES.find((f) => f.name === name)!;
  const answers: Record<string, number> = {};
  for (const id of AXIS_IDS) {
    const target = fig.positions[id];
    const aq = activeQuestions(id, version);
    if (!aq.length) continue;
    if (target == null) {
      aq.forEach(({ i }) => (answers[axisKey(id, i)] = 0));
      continue;
    }
    const Wsum = aq.reduce((s, { q }) => s + q.weight, 0);
    const desired = target * 2 * Wsum;
    const ideal = aq.map(({ q }) => {
      const dir = Math.sign(target * q.effect) || 0;
      return Math.max(-2, Math.min(2, Math.round(dir * 2 * Math.abs(target))));
    });
    const ach = () => aq.reduce((s, { q }, k) => s + ideal[k] * q.effect * q.weight, 0);
    let guard = 0;
    while (Math.abs(ach() - desired) >= 0.5 && guard++ < 400) {
      const diff = desired - ach();
      let done = false;
      for (let k = 0; k < aq.length; k++) {
        const step = diff > 0 ? Math.sign(aq[k].q.effect) : -Math.sign(aq[k].q.effect);
        if (step === 0) continue;
        const next = ideal[k] + step;
        if (next > 2 || next < -2) continue;
        ideal[k] = next;
        done = true;
        break;
      }
      if (!done) break;
    }
    aq.forEach(({ i }, k) => (answers[axisKey(id, i)] = ideal[k]));
  }
  return answers;
}

describe('compass engine', () => {
  it('exports the expected axis count and per-version totals', () => {
    expect(AXIS_IDS).toHaveLength(11);
    const short = versionTotals('short');
    const standard = versionTotals('standard');
    const full = versionTotals('full');
    expect(short.total).toBeGreaterThan(50);
    expect(short.total).toBeLessThan(70);
    expect(standard.total).toBeGreaterThan(100);
    expect(standard.total).toBeLessThan(130);
    expect(full.total).toBeGreaterThan(240);
  });

  it('every axis is balanced within ±4 across the full version', () => {
    for (const id of AXIS_IDS) {
      const pos = QUESTIONS[id].filter((q) => q.effect === 1).length;
      const neg = QUESTIONS[id].filter((q) => q.effect === -1).length;
      expect(Math.abs(pos - neg)).toBeLessThan(4);
    }
  });

  it('every figure matches itself #1 when filled (full version)', () => {
    let selfTop = 0;
    for (const f of FIGURES) {
      const answers = fillForFigure(f.name, 'full');
      const scores = computeScores(answers, 'full');
      const { matches } = matchFigures(scores.axes, scores.align);
      if (matches[0]?.figure.name === f.name) selfTop++;
    }
    expect(selfTop).toBe(FIGURES.length);
  });

  it('random uniform answers rarely produce a strong match', () => {
    let strong = 0;
    for (let t = 0; t < 200; t++) {
      const answers: Record<string, number> = {};
      for (const id of AXIS_IDS) for (const { i } of activeQuestions(id, 'standard')) answers[axisKey(id, i)] = Math.floor(Math.random() * 5) - 2;
      const scores = computeScores(answers, 'standard');
      const { hasStrongMatch } = matchFigures(scores.axes, scores.align);
      if (hasStrongMatch) strong++;
    }
    expect(strong / 200).toBeLessThan(0.2);
  });

  it('consistency is high for one-sided fillers and low for contradictory ones', () => {
    const oneSided = fillForFigure('حافظ الأسد'.length ? FIGURES[0].name : '', 'standard');
    const cHigh = computeConsistency(oneSided, 'standard');
    // contradictory: answer both poles +2 on auth_lib
    const contradictory: Record<string, number> = {};
    activeQuestions('auth_lib', 'standard').forEach(({ q, i }, k) => {
      contradictory[axisKey('auth_lib', i)] = k % 2 === 0 ? 2 * q.effect : -2 * q.effect;
    });
    const cLow = computeConsistency(contradictory, 'standard');
    expect(cHigh).toBeGreaterThan(cLow);
  });
});
