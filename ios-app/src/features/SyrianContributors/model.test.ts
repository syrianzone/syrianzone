import { expect, test } from 'bun:test';
import { decodeContributors, rankContributors } from './model';
const row = { username: 'one', avatar_url: 'https://example.test/a.png', daily_contributions: 2, monthly_contributions: 7, yearly_contributions: 12, total_contributions: 30 };
test('uses static leaderboard metrics rather than unrelated database pagination', () => {
  const entries = decodeContributors([row, { ...row, username: 'two', daily_contributions: 5, total_contributions: 20 }]);
  expect(rankContributors(entries, 'daily_contributions')[0]?.username).toBe('two');
  expect(rankContributors(entries, 'total_contributions')[0]?.username).toBe('one');
  expect(() => decodeContributors({ data: [row] })).toThrow();
  expect(() => decodeContributors([{ ...row, yearly_contributions: -1 }])).toThrow();
});
