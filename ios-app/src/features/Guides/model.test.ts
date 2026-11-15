import { expect, test } from 'bun:test';
import { decodeGuides, nextRank, rankName, milestones } from './model';

test('guide ranking retains the server order, including equal-score ties', () => {
  const guide = { rank: 1, user_id: 8, name: 'مرشد', avatar_url: null, approved_count: 4, saves_total: 3, recent_count: 1, points: 75, level: 3 };
  const result = decodeGuides({ sort: 'points', guides: [guide, { ...guide, rank: 2, user_id: 2 }] });
  expect(result.map(row => row.id)).toEqual([8, 2]);
  expect(result[0]?.recent).toBe(1);
});
test('rank thresholds and names match all source milestone boundaries', () => {
  expect(milestones.map(row => row.points)).toEqual([0, 15, 75, 250, 500, 1500, 5000, 15000, 50000, 100000]);
  expect(nextRank(14)).toEqual({ level: 2, points: 15 }); expect(nextRank(15)).toEqual({ level: 3, points: 75 });
  expect(nextRank(100000)).toBeNull(); expect(rankName(10)).toBe('وزير السياحة');
  expect(rankName(99)).toBe('وزير السياحة');
});
