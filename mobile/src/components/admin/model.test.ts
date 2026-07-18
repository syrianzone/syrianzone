import type { PollCandidate, PollGroup } from '@/lib/api/polls';

import {
  candidateSuccessors,
  canManagePolls,
  filterCandidates,
  isoDate,
  moveGroup,
  pollSlug,
} from './model';

const groups: PollGroup[] = [
  {
    id: 'group-a',
    isDefault: true,
    key: 'a',
    name: 'الأولى',
    pollId: 'poll-1',
    sortOrder: 0,
  },
  {
    id: 'group-b',
    isDefault: false,
    key: 'b',
    name: 'الثانية',
    pollId: 'poll-1',
    sortOrder: 1,
  },
];

function candidate(
  id: string,
  groupId: string | null,
  status: PollCandidate['status'] = 'active',
): PollCandidate {
  return {
    archiveReason: null,
    category: 'minister',
    groupId,
    id,
    imageUrl: null,
    name: id,
    status,
    successorId: null,
    termEndedAt: null,
    termStartedAt: null,
    title: null,
  };
}

describe('poll administration model', () => {
  test('gates poll administration to admin and superadmin roles', () => {
    expect(canManagePolls('admin')).toBe(true);
    expect(canManagePolls('superadmin')).toBe(true);
    expect(canManagePolls('transit_admin')).toBe(false);
    expect(canManagePolls('user')).toBe(false);
  });

  test('filters candidates by group and lifecycle status', () => {
    const candidates = [
      candidate('one', 'group-a'),
      candidate('two', 'group-a', 'archived'),
      candidate('three', 'group-b'),
    ];
    expect(
      filterCandidates(candidates, 'group-a', 'active').map(
        (item) => item.id,
      ),
    ).toEqual(['one']);
    expect(filterCandidates(candidates, 'all', 'archived')).toEqual([
      candidates[1],
    ]);
  });

  test('moves groups with the source RTL index rules and rewrites sort order', () => {
    expect(moveGroup(groups, 'group-a', 'left')).toEqual([
      { ...groups[1], sortOrder: 0 },
      { ...groups[0], sortOrder: 1 },
    ]);
    expect(moveGroup(groups, 'group-a', 'right')).toEqual(groups);
  });

  test('limits successors to active candidates in the same group', () => {
    const target = candidate('one', 'group-a');
    const valid = candidate('two', 'group-a');
    expect(
      candidateSuccessors(
        [target, valid, candidate('three', 'group-b'), candidate('four', 'group-a', 'archived')],
        target,
      ),
    ).toEqual([valid]);
  });

  test('normalizes slugs and derives archive dates from injected time', () => {
    expect(pollSlug('  Cabinet Review 2026  ')).toBe(
      'cabinet-review-2026',
    );
    expect(isoDate(new Date('2026-07-16T23:58:00Z'))).toBe('2026-07-16');
  });
});
