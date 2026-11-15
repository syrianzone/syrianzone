import { record, text } from '../../platform/validation';
import { positiveId } from '../../platform/entity-data';
import { decodeLocalDraft, type StudioDraft } from './model';
export interface PendingStudio { version: 1; ownerId: number | null; target: string; draft: StudioDraft }
export const pendingKey = 'transit-studio.pending.v1';
export function decodePending(value: unknown): PendingStudio | null {
  if (value === null) return null;
  const row = record(value), target = text(row.target);
  if (row.version !== 1 || !/^(?:new:[a-zA-Z0-9_-]{0,128}|edit:[a-zA-Z0-9_-]{1,128})$/.test(target)) throw new Error('المسودة المحفوظة غير صالحة. لم تُحذف بياناتك.');
  return { version: 1, ownerId: row.ownerId === null ? null : positiveId(row.ownerId), target, draft: decodeLocalDraft(row.draft) };
}
export function canRestorePending(pending: PendingStudio, target: string, ownerId: number | null): boolean {
  if (pending.target !== target) return false;
  if (pending.ownerId !== null) return pending.ownerId === ownerId;
  return target.startsWith('new:') && pending.draft.editingDraftId === null && pending.draft.editingRouteId === null;
}
export const memoryDrafts = new Map<string, StudioDraft>();
