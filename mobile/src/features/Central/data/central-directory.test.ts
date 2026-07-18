import { centralDirectoryData } from './central-directory';

test('bundles every Central source record with unique category ids', () => {
  expect(centralDirectoryData.governorates).toHaveLength(14);
  expect(centralDirectoryData.presidency.entities).toHaveLength(5);
  expect(centralDirectoryData.presidency.ministries).toHaveLength(23);

  const ids = [
    ...centralDirectoryData.governorates.map((item) => `governorate:${item.id}`),
    ...centralDirectoryData.presidency.entities.map((item) => `entity:${item.id}`),
    ...centralDirectoryData.presidency.ministries.map((item) => `ministry:${item.id}`),
  ];
  expect(new Set(ids).size).toBe(ids.length);
});
