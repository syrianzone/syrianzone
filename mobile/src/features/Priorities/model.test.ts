import { Base64 } from 'js-base64';

import {
  analyzeDependencies,
  buildPrioritySummary,
  cloneTopics,
  decodePriorityState,
  encodePriorityState,
  priorityShareUrl,
  radarPoints,
  setTopicPoints,
  toggleSubFile,
  totalPoints,
} from './model';

describe('Syria priorities model', () => {
  test('never allocates more than the 100 point budget', () => {
    let topics = cloneTopics();
    topics = setTopicPoints(topics, 'economy', 70);
    topics = setTopicPoints(topics, 'justice', 60);
    expect(totalPoints(topics)).toBe(100);
    expect(topics.find((topic) => topic.id === 'justice')?.points).toBe(30);
  });

  test('limits selected subfiles and reports unmet dependencies', () => {
    let selected: ReadonlySet<string> = new Set();
    for (const id of [
      'political_parties',
      'salaries',
      'private_sector',
      'agriculture_industry',
      'corruption_trials',
      'land_digitalization',
    ]) {
      selected = toggleSubFile(selected, id);
    }
    expect(selected.size).toBe(5);
    const analysis = analyzeDependencies(cloneTopics(), selected);
    expect(analysis.alerts.find((item) => item.name.includes('الأحزاب')))
      .toMatchObject({ fulfilled: false });
  });

  test('round trips a bounded share state', () => {
    let topics = setTopicPoints(cloneTopics(), 'economy', 55);
    topics = setTopicPoints(topics, 'justice', 45);
    const encoded = encodePriorityState(topics, new Set(['salaries']));
    const decoded = decodePriorityState(encoded);
    expect(decoded && totalPoints(decoded.topics)).toBe(100);
    expect(decoded?.selected.has('salaries')).toBe(true);
  });

  test('decodes the standard Base64 state emitted by the web screen', () => {
    const state = Base64.encode(
      'economy:55,justice:45,housing:0,security:0,politics:0,digital:0|salaries',
    );
    const decoded = decodePriorityState(state);

    expect(decoded?.topics.find((topic) => topic.id === 'economy')?.points)
      .toBe(55);
    expect(decoded?.selected.has('salaries')).toBe(true);
  });

  test('rejects malformed, oversized, and over-budget shared state', () => {
    expect(decodePriorityState('not base64!')).toBeNull();
    expect(decodePriorityState('a'.repeat(2049))).toBeNull();
    expect(
      decodePriorityState(
        encodePriorityState(
          cloneTopics().map((topic) => ({ ...topic, points: 100 })),
          new Set(),
        ),
      ),
    ).toBeNull();
  });

  test('builds the source-compatible copy and smart link only for a full budget', () => {
    let topics = setTopicPoints(cloneTopics(), 'economy', 60);
    topics = setTopicPoints(topics, 'justice', 40);
    const selected = new Set(['salaries']);
    const summary = buildPrioritySummary(
      topics,
      selected,
      'محرك الاقتصاد',
      'توازن ديناميكي متوسط',
    );

    expect(summary).toContain('محرك الاقتصاد');
    expect(summary).toContain('1. 💼 الملف الاقتصادي ومعالجة الفساد: %60');
    expect(summary).toContain('تحسين الرواتب');
    expect(priorityShareUrl(topics, selected)).toMatch(
      /^https:\/\/syrian\.zone\/priorities\?state=/,
    );
    expect(buildPrioritySummary(cloneTopics(), selected, '', '')).toBeNull();
  });

  test('maps bounded radar values around the requested center', () => {
    const points = radarPoints([45, 45, 45, 45], 50, 40, 45);
    expect(points).toHaveLength(4);
    expect(points[0]).toEqual({ x: 50, y: 10 });
    expect(points[2]).toEqual({ x: 50, y: 90 });
    expect(radarPoints([1, 2], 50, 40, 45)).toEqual([]);
  });
});
