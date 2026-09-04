import * as ProjectIcons from '@/components/icons/ProjectIcons';

import { featureRegistry } from './registry';

const bySlug = (slug: string) =>
  featureRegistry.find((feature) => feature.slug === slug);

test('registers Board as a native route and removes the retired Central directory', () => {
  expect(bySlug('board')).toMatchObject({
    labelAr: 'لوح',
    labelEn: 'Board',
  });
  expect(bySlug('central')).toBeUndefined();
});

test('every feature carries an icon component', () => {
  for (const feature of featureRegistry) {
    expect(feature.icon).toBeTruthy();
    expect(['function', 'object']).toContain(typeof feature.icon);
  }
});

test.each<[string, keyof typeof ProjectIcons]>([
  ['board', 'BoardIcon'],
  ['syofficial', 'SyOfficialIcon'],
  ['roznama', 'RoznamaIcon'],
  ['phonebook', 'PhonebookIcon'],
  ['warnings', 'WarningsIcon'],
  ['syid', 'SyIdIcon'],
  ['party', 'PartyIcon'],
  ['tierlist', 'TierlistIcon'],
  ['house', 'HouseIcon'],
  ['compass', 'CompassIcon'],
  ['priorities', 'PrioritiesIcon'],
  ['sites', 'SitesIcon'],
  ['population', 'PopulationIcon'],
  ['govapps', 'GovAppsIcon'],
  ['transit', 'TransitIcon'],
  ['places', 'MishwarIcon'],
  ['justice', 'JusticeIcon'],
])('%s draws the website %s', (slug, iconName) => {
  const icons: Record<string, unknown> = ProjectIcons;
  expect(bySlug(slug)?.icon).toBe(icons[iconName]);
});

test('lists emergency alerts right after the phonebook', () => {
  const slugs = featureRegistry.map((feature) => feature.slug);
  expect(slugs.indexOf('warnings')).toBe(slugs.indexOf('phonebook') + 1);
  expect(bySlug('warnings')).toMatchObject({
    descriptionAr: 'تحذيرات وزارة الطوارئ وإدارة الكوارث',
    descriptionEn: 'Alerts from the Ministry of Emergency and Disaster Management',
    labelAr: 'تنبيهات الطوارئ',
    labelEn: 'Emergency alerts',
  });
});
