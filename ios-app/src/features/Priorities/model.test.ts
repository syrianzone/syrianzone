import { describe, expect, test } from 'bun:test';
import { INITIAL_TOPICS, DEPENDENCIES } from '../../../../resources/js/Pages/Priorities/data';
import { allocate, decodeSharedState, encodeSharedState, initialState, interdependencies, persona, toggleSubfile, totalAllocated } from './model';

describe('priorities source allocation invariants', () => {
  test('uses all original six topics without mutating shared facts', () => {
    const state = initialState();
    expect(Object.keys(state.points)).toEqual(INITIAL_TOPICS.map(topic => topic.id));
    expect(totalAllocated(state)).toBe(0);
    expect(persona(state)).toBeNull();
  });
  test('last allocation clamps to remaining shared budget and lower bound', () => {
    let state = allocate(initialState(), 'economy', 75);
    state = allocate(state, 'justice', 70);
    expect(state.points.justice).toBe(25);
    expect(totalAllocated(state)).toBe(100);
    expect(allocate(state, 'economy', -1).points.economy).toBe(0);
    expect(allocate(state, 'economy', 1.4).points.economy).toBe(1);
    expect(() => allocate(state, 'economy', NaN)).toThrow();
    expect(() => allocate(state, 'unknown', 50)).toThrow();
    expect(INITIAL_TOPICS[0]?.points).toBe(0);
  });
  test('rapid independent assignments cannot overspend100', () => {
    let state = initialState();
    for (let i = 0; i < 1000; i += 1) {
      const topic = INITIAL_TOPICS[i % INITIAL_TOPICS.length]!;
      state = allocate(state, topic.id, i % 101);
      expect(totalAllocated(state)).toBeLessThanOrEqual(100);
    }
  });
  test('at most five valid subfiles; deselect frees a slot', () => {
    const ids = INITIAL_TOPICS.flatMap(topic => topic.subFiles.map(sub => sub.id));
    let state = initialState();
    for (const id of ids.slice(0, 5)) state = toggleSubfile(state, id);
    expect(() => toggleSubfile(state, ids[5]!)).toThrow('خمسة');
    state = toggleSubfile(state, ids[0]!);
    expect(toggleSubfile(state, ids[5]!).selected).toHaveLength(5);
    expect(() => toggleSubfile(state, 'unknown')).toThrow();
  });
  test('dependency warnings, fulfillment and complexity match source', () => {
    const [id, dependency] = Object.entries(DEPENDENCIES)[0]!;
    const state = toggleSubfile(initialState(), id);
    const info = interdependencies(state);
    expect(info.complexity).toBe(43);
    expect(info.alerts[0]?.missing).toEqual(dependency.requires);
    let fulfilled = state;
    for (const required of dependency.requires) fulfilled = toggleSubfile(fulfilled, required);
    expect(interdependencies(fulfilled).alerts.find(alert => alert.id === id)?.fulfilled).toBe(true);
    expect(interdependencies(initialState()).complexity).toBe(10);
  });
  test('persona requires completed budget; ties use original topic order', () => {
    const state = allocate(allocate(initialState(), 'justice', 50), 'economy', 50);
    expect(persona(state)?.id).toBe('economy');
    expect(persona(allocate(initialState(), 'justice', 99))).toBeNull();
    expect(persona(allocate(initialState(), 'justice', 100))?.id).toBe('justice');
  });
  test('shared links round-trip original website base64 schema including selected subfiles', () => {
    const state = toggleSubfile(allocate(initialState(), 'economy', 100), 'salaries');
    const encoded = encodeSharedState(state);
    expect(atob(encoded)).toBe('economy:100,justice:0,housing:0,security:0,politics:0,digital:0|salaries');
    expect(decodeSharedState(encoded)).toEqual(state);
    expect(decodeSharedState(encodeURIComponent(encoded))).toEqual(state);
  });
  test('rejects malformed, overbudget, duplicate and unknown shared state', () => {
    for (const input of ['%', btoa('economy:101|'), btoa('economy:60,justice:60|'), btoa('economy:-1|'), btoa('evil:10|'), btoa('economy:50,economy:20|'), btoa('economy:100|unknown'), btoa('economy:100|salaries,salaries'), 'a'.repeat(5000)]) {
      expect(() => decodeSharedState(input)).toThrow();
    }
  });
});
