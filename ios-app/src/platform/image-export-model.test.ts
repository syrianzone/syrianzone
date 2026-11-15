import { expect, test } from 'bun:test';
import { imageExportPlan } from './image-export-model';
test('SVG export preserves exact integer viewBox geometry and the full16MP source budget', () => {
  for (const [width, height] of [
    [80, 40],
    [1080, 1920],
    [2000, 7500],
    [4000, 4000],
    [4000, 3999],
    [16000000, 1],
    [1, 16000000],
    [1, 1],
  ] as const) {
    const plan = imageExportPlan({ width, height });
    expect([plan.renderWidth, plan.renderHeight]).toEqual([width, height]);
    expect(plan.renderWidth * plan.renderHeight).toBeLessThanOrEqual(16_000_000);
    expect(plan.renderWidth / plan.renderHeight).toBe(width / height);
  }
  expect(imageExportPlan({ width: 4000, height: 4000 })).toMatchObject({
    width: 4000,
    height: 4000,
    renderWidth: 4000,
    renderHeight: 4000,
  });
});
test('real JPEG exports preserve source quality and reject impossible native bounds before allocating', () => {
  expect(imageExportPlan({ width: 600, height: 600, format: 'jpg', quality: 0.9 })).toMatchObject({
    format: 'jpg',
    quality: 0.9,
    mimeType: 'image/jpeg',
  });
  for (const input of [
    { width: 0, height: 10 },
    { width: 1.1, height: 10 },
    { width: 4001, height: 4000 },
    { width: 80, height: 40, quality: NaN },
    { width: 80, height: 40, quality: 1.1 },
  ])
    expect(() => imageExportPlan({ ...input })).toThrow();
});
