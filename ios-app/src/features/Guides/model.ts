import { array, assetUrl, record, text } from '../../platform/validation';
import { nonnegative, positiveId } from '../../platform/entity-data';
export interface Guide { id: number; rank: number; name: string; avatar: string | null; approved: number; saves: number; recent: number; points: number; level: number }
export type GuideSort = 'points' | 'submissions' | 'saves' | 'recent';
export { milestones, nextRank, rankName } from '../../platform/guide-rank';
export function decodeGuides(value: unknown): Guide[] {
  const row = record(value);
  if (!['points', 'submissions', 'saves', 'recent'].includes(text(row.sort))) throw new Error('ترتيب المرشدين غير صالح.');
  return array(row.guides).map(item => { const guide = record(item); return { id: positiveId(guide.user_id), rank: positiveId(guide.rank), name: text(guide.name), avatar: assetUrl(guide.avatar_url), approved: nonnegative(guide.approved_count), saves: nonnegative(guide.saves_total), recent: nonnegative(guide.recent_count), points: nonnegative(guide.points), level: positiveId(guide.level) }; });
}
// PORT STATUS: source resources/js/Pages/Places/_components/GuidesTab.tsx,GuideProfileCard.tsx,LevelBadge.tsx,MilestonesSheet.tsx; confidence high; todos 0.
