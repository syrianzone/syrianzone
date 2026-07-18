import type { PollCandidate, PollGroup } from '@/lib/api/polls';

export type CandidateStatusFilter = 'active' | 'all' | 'archived';
export type GroupMoveDirection = 'left' | 'right';

export function canManagePolls(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'superadmin';
}

export function filterCandidates(
  candidates: readonly PollCandidate[],
  groupId: string | 'all',
  status: CandidateStatusFilter,
): PollCandidate[] {
  return candidates.filter(
    (candidate) =>
      (groupId === 'all' || candidate.groupId === groupId) &&
      (status === 'all' || candidate.status === status),
  );
}

export function moveGroup(
  groups: readonly PollGroup[],
  id: string,
  direction: GroupMoveDirection,
): PollGroup[] {
  const ordered = [...groups].sort(
    (left, right) => left.sortOrder - right.sortOrder,
  );
  const index = ordered.findIndex((group) => group.id === id);
  const targetIndex = direction === 'left' ? index + 1 : index - 1;
  if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) {
    return ordered;
  }
  [ordered[index], ordered[targetIndex]] = [
    ordered[targetIndex]!,
    ordered[index]!,
  ];
  return ordered.map((group, sortOrder) => ({ ...group, sortOrder }));
}

export function candidateSuccessors(
  candidates: readonly PollCandidate[],
  target: PollCandidate | null,
): PollCandidate[] {
  if (!target) {
    return [];
  }
  return candidates.filter(
    (candidate) =>
      candidate.id !== target.id &&
      candidate.groupId === target.groupId &&
      candidate.status === 'active',
  );
}

export function pollSlug(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('en')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
