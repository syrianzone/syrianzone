import { expect, test } from 'bun:test';
import { AXES } from '../../../../resources/js/Domain/compass/axes';
import { buildResult, decodeCompassPage, decodeProgress, questionList, quizCommand, strongestAxis, updateHistory } from './model';
import { engine } from './engine';

test('Compass preserves numeric answer shortcuts and RTL previous/next arrows', () => {
  expect(quizCommand('1')).toEqual({ kind: 'answer', value: -2 }); expect(quizCommand('3')).toEqual({ kind: 'answer', value: 0 }); expect(quizCommand('5')).toEqual({ kind: 'answer', value: 2 });
  expect(quizCommand('ArrowRight')).toEqual({ kind: 'previous' }); expect(quizCommand('ArrowLeft')).toEqual({ kind: 'next' }); expect(quizCommand('Enter')).toBeNull();
});

test('Compass reuses source version totals and stable question keys without dropping alignment', () => {
  for (const version of ['short', 'standard', 'full'] as const) {
    const questions = questionList(version);
    expect(questions).toHaveLength(engine.versionTotals(version).total);
    expect(new Set(questions.map(question => question.key)).size).toBe(questions.length);
    expect(questions.some(question => question.key.startsWith('align#'))).toBe(true);
    expect(new Set(questions.filter(question => !question.key.startsWith('align#')).map(question => question.key.split('#')[0])).size).toBe(11);
  }
});
test('Compass source scoring keeps weights, version tiers and unanswered axes', () => {
  const empty = engine.computeScores({}, 'short');
  expect(AXES.every(axis => empty.axes[axis.id] === null)).toBe(true);
  expect(engine.computeConsistency({}, 'short')).toBe(1);
  const answers = Object.fromEntries(questionList('short').map(question => [question.key, 2]));
  const result = buildResult(answers, 'short', { figures: [], personas: [] }, 'fixture');
  expect(result.answered).toBe(questionList('short').length);
  expect(result.spectrum).toBeNull();
  expect(result.topFigure).toBeNull();
  expect(result.scores).toEqual(engine.computeScores(answers, 'short').axes);
});
test('the strongest answered axis uses absolute strength, source order for ties and the matching pole', () => {
  const first = AXES[0]!, second = AXES[1]!;
  expect(strongestAxis({})).toBeNull();
  expect(strongestAxis({ [first.id]: 0.25, [second.id]: -0.8 })).toEqual({ id: second.id, name: second.name, value: -0.8, pole: second.left });
  expect(strongestAxis({ [first.id]: 0.8, [second.id]: -0.8 })?.id).toBe(first.id);
  expect(strongestAxis({ [first.id]: 0 })).toEqual({ id: first.id, name: first.name, value: 0, pole: first.left });
});
test('Compass validates stored progress against version questions and five-point answer bounds', () => {
  const first = questionList('short')[0]!;
  expect(decodeProgress({ version: 'short', answers: { [first.key]: 1 }, index: 1, updatedAt: '2026-11-14T12:00:00Z' })?.index).toBe(1);
  for (const answers of [{ [first.key]: 3 }, { [first.key]: 0.5 }, { unknown: 2 }]) expect(() => decodeProgress({ version: 'short', answers, index: 0, updatedAt: '2026-11-14' })).toThrow();
  expect(() => decodeProgress({ version: 'short', answers: {}, index: 10000, updatedAt: '2026-11-14' })).toThrow();
});
test('Compass local history is bounded and same-id updates do not duplicate results', () => {
  const result = buildResult({}, 'short', { figures: [], personas: [] }, 'same');
  let history = updateHistory([], result);
  history = updateHistory(history, { ...result, savedToAccount: true });
  expect(history).toHaveLength(1);
  expect(history[0]?.savedToAccount).toBe(true);
  for (let index = 0; index < 60; index += 1) history = updateHistory(history, { ...result, id: String(index) });
  expect(history).toHaveLength(50);
  expect(history[0]?.id).toBe('59');
});
test('Compass public config validates enabled vectors and sparse ranges', () => {
  expect(decodeCompassPage({ figures: [], personas: [] })).toEqual({ figures: [], personas: [] });
  const figure = { name: 'شخصية', category: 'current', align: 'west', positions: { auth_lib: 0.5 }, image: null };
  expect(decodeCompassPage({ figures: [figure], personas: [] }).figures[0]?.positions.auth_lib).toBe(0.5);
  expect(() => decodeCompassPage({ figures: [{ ...figure, positions: { auth_lib: 2 } }], personas: [] })).toThrow();
  expect(() => decodeCompassPage({ figures: [], personas: [{ id: 'a', name: 'اسم', icon: 'Shield', short: '', stances: [], factoid: '', center: {}, ranges: { auth_lib: { min: 0.5, max: -0.5 } } }] })).toThrow();
});
