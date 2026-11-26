import { describe, expect, it } from 'vitest';
import { decodeShareState, encodeShareState, shareStateUrl } from './shareState';

const known = {
  topics: ['economy', 'justice', 'housing', 'ax~'],
  subFiles: ['salaries', 'war_trials', 'drug_rehab', 's1', 's2', 's3', 's4'],
  budget: 100,
  maxSubFiles: 5,
};

/** The encoder the page shipped before shareState.ts. */
const legacyEncode = (text: string) => btoa(unescape(encodeURIComponent(text)));

describe('priorities share state', () => {
  it('round-trips through a real URL even when the payload contains "+"', () => {
    const state = encodeShareState({ 'ax~': 1, economy: 0, justice: 10 }, ['salaries']);
    expect(state).toContain('+');

    const href = shareStateUrl({ origin: 'https://syrian.zone', pathname: '/priorities' }, state);
    const param = new URL(href).searchParams.get('state');
    expect(param).toBe(state);
    expect(decodeShareState(param!, known)).toEqual({
      points: { 'ax~': 1, economy: 0, justice: 10 },
      subFiles: ['salaries'],
    });
  });

  it('decodes a legacy link whose raw base64 "+" arrived as a space', () => {
    const text = 'ax~:1,economy:0,justice:10|salaries';
    const legacy = legacyEncode(text);
    expect(legacy).toContain('+');

    const param = new URLSearchParams(`state=${legacy}`).get('state')!;
    expect(param).toContain(' ');
    expect(decodeShareState(param, known)).toEqual({
      points: { 'ax~': 1, economy: 0, justice: 10 },
      subFiles: ['salaries'],
    });
  });

  it('reads an ordinary legacy link byte-identically', () => {
    const legacy = legacyEncode('economy:60,justice:40|war_trials,drug_rehab');
    expect(decodeShareState(legacy, known)).toEqual({
      points: { economy: 60, justice: 40 },
      subFiles: ['war_trials', 'drug_rehab'],
    });
  });

  it('drops unknown ids, clamps to the budget and de-duplicates sub-files', () => {
    const state = encodeShareState(
      { economy: 90, justice: 90, housing: -5, bogus: 10 },
      ['salaries', 'salaries', 'nope', 's1', 's2', 's3', 's4'],
    );
    expect(decodeShareState(state, known)).toEqual({
      points: { economy: 90, justice: 10, housing: 0 },
      subFiles: ['salaries', 's1', 's2', 's3', 's4'],
    });
  });

  it('returns null for garbage', () => {
    expect(decodeShareState('%%%not base64', known)).toBeNull();
    expect(decodeShareState(btoa('\xff\xfe'), known)).toBeNull();
  });
});
