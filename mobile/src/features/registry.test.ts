import { featureRegistry } from './registry';

test('registers Board as a native route and removes the retired Central directory', () => {
  expect(featureRegistry.find((feature) => feature.slug === 'board')).toMatchObject({
    labelAr: 'لوح',
    labelEn: 'Board',
  });
  expect(featureRegistry.some((feature) => feature.slug === 'central')).toBe(false);
});
