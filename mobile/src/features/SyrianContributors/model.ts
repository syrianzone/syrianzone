export type ContributionMetric =
  | 'daily_contributions'
  | 'monthly_contributions'
  | 'total_contributions'
  | 'yearly_contributions';

export interface Contributor {
  avatar_url: string;
  daily_contributions: number;
  monthly_contributions: number;
  total_contributions: number;
  username: string;
  yearly_contributions: number;
}

export interface ContributionPeriod {
  label: string;
  metric: ContributionMetric;
  title: string;
}

export const CONTRIBUTION_PERIODS: readonly ContributionPeriod[] = [
  {
    label: 'يومي',
    metric: 'daily_contributions',
    title: 'أفضل المساهمين اليوم',
  },
  {
    label: 'شهري',
    metric: 'monthly_contributions',
    title: 'أفضل المساهمين هذا الشهر',
  },
  {
    label: 'سنوي',
    metric: 'yearly_contributions',
    title: 'أفضل المساهمين هذا العام',
  },
  {
    label: 'إجمالي',
    metric: 'total_contributions',
    title: 'أفضل المساهمين على الإطلاق',
  },
] as const;

export function sortContributors(
  contributors: readonly Contributor[],
  metric: ContributionMetric,
): Contributor[] {
  return [...contributors].sort(
    (left, right) =>
      right[metric] - left[metric] ||
      left.username.localeCompare(right.username, 'en'),
  );
}

export function contributorInitials(username: string): string {
  return username.trim().slice(0, 2).toLocaleUpperCase('en');
}

export function githubProfileUrl(username: string): string {
  return `https://github.com/${encodeURIComponent(username)}`;
}
