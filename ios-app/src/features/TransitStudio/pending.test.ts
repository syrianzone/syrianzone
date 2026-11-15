import { expect, test } from 'bun:test';
import { decodePending, canRestorePending } from './pending';
import { emptyDraft } from './model';
test('pending login drawings retain their geometry/color but remain scoped to an existing owner', () => {
  const pending = decodePending({ version: 1, ownerId: 7, target: 'edit:4', draft: { ...emptyDraft('damascus'), colorIndex: 3, editingDraftId: 4, segments: [[{ latitude: 33, longitude: 36 }, { latitude: 34, longitude: 37 }]] } })!;
  expect(pending.draft.colorIndex).toBe(3); expect(pending.draft.segments[0]).toHaveLength(2);
  expect(canRestorePending(pending, 'edit:4', 7)).toBe(true);
  expect(canRestorePending(pending, 'edit:4', 8)).toBe(false);
  expect(canRestorePending(pending, 'edit:5', 7)).toBe(false);
  expect(canRestorePending({ ...pending, ownerId: null }, 'edit:4', 8)).toBe(false);
  expect(canRestorePending({ version: 1, ownerId: null, target: 'new:damascus', draft: emptyDraft('damascus') }, 'new:damascus', 8)).toBe(true);
  expect(() => decodePending({ version: 1, target: 'new:damascus', draft: emptyDraft('damascus') })).toThrow();
});
