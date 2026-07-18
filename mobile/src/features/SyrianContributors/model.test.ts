import {
  CONTRIBUTION_PERIODS,
  contributorInitials,
  githubProfileUrl,
  sortContributors,
  type Contributor,
} from './model';

const contributors: Contributor[] = [
  {
    avatar_url: 'https://avatars.example/rami.png',
    daily_contributions: 3,
    monthly_contributions: 80,
    total_contributions: 900,
    username: 'rami',
    yearly_contributions: 300,
  },
  {
    avatar_url: '',
    daily_contributions: 9,
    monthly_contributions: 20,
    total_contributions: 200,
    username: 'lama',
    yearly_contributions: 100,
  },
];

describe('Syrian contributor ranking', () => {
  test('keeps the source daily, monthly, yearly, and total contract', () => {
    expect(CONTRIBUTION_PERIODS.map((period) => period.metric)).toEqual([
      'daily_contributions',
      'monthly_contributions',
      'yearly_contributions',
      'total_contributions',
    ]);
  });

  test('sorts a copy by the selected period without mutating API order', () => {
    expect(
      sortContributors(contributors, 'daily_contributions').map(
        (contributor) => contributor.username,
      ),
    ).toEqual(['lama', 'rami']);
    expect(contributors.map((contributor) => contributor.username)).toEqual([
      'rami',
      'lama',
    ]);
  });

  test('builds bounded initials and encoded GitHub links', () => {
    expect(contributorInitials(' z44d ')).toBe('Z4');
    expect(githubProfileUrl('name with space')).toBe(
      'https://github.com/name%20with%20space',
    );
  });
});
