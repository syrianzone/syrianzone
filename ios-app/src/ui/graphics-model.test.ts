import { expect, test } from 'bun:test';
import icons from '../../../resources/data/project-icons.json';
import { projectIconXml } from './graphics-model';

test('resolves every shared project drawing in both native themes without browser CSS', () => {
  for (const name of Object.keys(icons.icons)) for (const mode of ['light', 'dark'] as const) {
    const xml = projectIconXml(name, mode, '#123456');
    expect(xml).toContain('<svg');
    expect(xml).toContain('viewBox=');
    expect(xml).not.toMatch(/class=|currentColor|var\(|dark:/);
    expect(xml).toContain('</svg>');
  }
});
test('preserves theme-specific drawing colors, opacity and aliases', () => {
  expect(projectIconXml('answers', 'light', '#123456')).toContain('fill="#3B82F6" fill-opacity="0.15"');
  expect(projectIconXml('answers', 'dark', '#123456')).toContain('fill="#60A5FA" fill-opacity="0.25"');
  expect(projectIconXml('answers', 'dark', '#123456')).toContain('fill="#123456"');
  expect(projectIconXml('atlas', 'light', '#123456')).toBe(projectIconXml('population', 'light', '#123456'));
  expect(() => projectIconXml('not-a-project', 'light', '#123456')).toThrow();
});
