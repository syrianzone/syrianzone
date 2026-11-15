import { array, assetUrl, integer, record, text } from '../../platform/validation';
export type Metric = 'daily_contributions' | 'monthly_contributions' | 'yearly_contributions' | 'total_contributions';
export interface Contributor { username: string; avatar: string | null; daily_contributions: number; monthly_contributions: number; yearly_contributions: number; total_contributions: number }
export function decodeContributors(value: unknown): Contributor[] {
  return array(value).map(item => {
    const row = record(item);
    const count = (key: Metric): number => { const number = integer(row[key]); if (number < 0) throw new Error('عدد مساهمات غير صالح.'); return number; };
    return { username: text(row.username), avatar: assetUrl(row.avatar_url), daily_contributions: count('daily_contributions'), monthly_contributions: count('monthly_contributions'), yearly_contributions: count('yearly_contributions'), total_contributions: count('total_contributions') };
  });
}
export function rankContributors(entries: Contributor[], metric: Metric): Contributor[] { return entries.slice().sort((a, b) => b[metric] - a[metric]); }
// PORT STATUS: source resources/js/Pages/SyrianContributors/Index.tsx; confidence high; todos 0.
