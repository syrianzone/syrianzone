import type { PollCandidate, PollHistory } from '@/lib/api/polls';

import {
  buildChartSeries,
  canManagePolls,
  candidatesForGroup,
  createEmptyBoard,
  defaultGroupId,
  deterministicCandidateOrder,
  formatCompactNumber,
  moveCandidatesToTier,
  serializeBoard,
  switchCandidateGroup,
  toggleBoardSelection,
  validateBoard,
} from './model';

const candidates: PollCandidate[] = [
  {
    archiveReason: null,
    category: 'minister',
    groupId: 'ministers',
    id: 'candidate-1',
    imageUrl: null,
    name: 'الأول',
    status: 'active',
    successorId: null,
    termEndedAt: null,
    termStartedAt: null,
    title: 'وزير',
  },
  {
    archiveReason: null,
    category: 'governor',
    groupId: null,
    id: 'candidate-2',
    imageUrl: null,
    name: 'الثاني',
    status: 'active',
    successorId: null,
    termEndedAt: null,
    termStartedAt: null,
    title: null,
  },
  {
    archiveReason: null,
    category: 'minister',
    groupId: 'ministers',
    id: 'candidate-3',
    imageUrl: null,
    name: 'الثالث',
    status: 'active',
    successorId: null,
    termEndedAt: null,
    termStartedAt: null,
    title: null,
  },
];

test('uses the default group and preserves strict group membership', () => {
  expect(
    defaultGroupId([
      { id: 'one', isDefault: false },
      { id: 'two', isDefault: true },
    ]),
  ).toBe('two');
  expect(candidatesForGroup(candidates, 'ministers', 'minister')).toEqual([
    candidates[0],
    candidates[2],
  ]);
  expect(candidatesForGroup(candidates, 'governors', 'governor')).toEqual([
    candidates[1],
  ]);
});

test('daily candidate shuffle is deterministic and changes with the vote day', () => {
  const first = deterministicCandidateOrder(candidates, 'poll-1', '2026-07-15');
  const repeat = deterministicCandidateOrder(candidates, 'poll-1', '2026-07-15');
  const nextDay = deterministicCandidateOrder(candidates, 'poll-1', '2026-07-16');

  expect(first.map(({ id }) => id)).toEqual(repeat.map(({ id }) => id));
  expect(first).toHaveLength(3);
  expect(nextDay.map(({ id }) => id)).not.toEqual(first.map(({ id }) => id));
});

test('moves a multi-selection into a tier and serializes stable positions', () => {
  let board = createEmptyBoard();
  board = toggleBoardSelection(board, 'candidate-1');
  board = toggleBoardSelection(board, 'candidate-3');
  board = moveCandidatesToTier(board, 'S', candidates);

  expect(board.selected).toEqual([]);
  expect(board.tiers.S).toEqual(['candidate-1', 'candidate-3']);
  expect(serializeBoard(board).S).toEqual([
    { candidateId: 'candidate-1', pos: 0 },
    { candidateId: 'candidate-3', pos: 1 },
  ]);
  expect(validateBoard(board, 3)).toBe('اختر 3 مرشحين على الأقل قبل التصويت.');

  board = toggleBoardSelection(board, 'candidate-2');
  board = moveCandidatesToTier(board, 'A', candidates);
  expect(validateBoard(board, 3)).toBeNull();
});

test('switching groups clears the transient board state', () => {
  let board = toggleBoardSelection(createEmptyBoard(), 'candidate-1');
  board = moveCandidatesToTier(board, 'S', candidates);

  expect(switchCandidateGroup(board)).toEqual(createEmptyBoard());
});

test('builds cumulative monthly chart points from sparse daily history', () => {
  const history: PollHistory = {
    'candidate-1': [
      { date: '2026-01-02', score: 55, votes: 1 },
      { date: '2026-02-03', score: 40, votes: 1 },
    ],
    'candidate-2': [
      { date: '2026-02-03', score: 30, votes: 2 },
    ],
  };

  const chart = buildChartSeries(history, candidates.slice(0, 2), {
    metric: 'score',
    timeframe: 'month',
    view: 'cumulative',
  });

  expect(chart.labels).toEqual(['2026-01', '2026-02']);
  expect(chart.series[0]?.points).toEqual([55, 95]);
  expect(chart.series[1]?.points).toEqual([0, 30]);
});

test('keeps poll management role gates and number formatting explicit', () => {
  expect(canManagePolls('admin')).toBe(true);
  expect(canManagePolls('superadmin')).toBe(true);
  expect(canManagePolls('transit_admin')).toBe(false);
  expect(canManagePolls(null)).toBe(false);
  expect(formatCompactNumber(950)).toBe('950');
  expect(formatCompactNumber(12_400)).toBe('12.4K');
  expect(formatCompactNumber(2_000_000)).toBe('2M');
});
