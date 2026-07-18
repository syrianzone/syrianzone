import { syidAssetUrl } from './files';

describe('Syrian identity asset URLs', () => {
  test('keeps identity media first party and safely encoded', () => {
    const url = new URL(syidAssetUrl('العلم السوري بالنسب الصحيحة.svg'));
    expect(url.origin).toBe('https://syrian.zone');
    expect(decodeURIComponent(url.pathname)).toBe(
      '/syid-assets/materials/العلم السوري بالنسب الصحيحة.svg',
    );
  });

  test('rejects traversal and absolute paths', () => {
    expect(() => syidAssetUrl('../secret')).toThrow();
    expect(() => syidAssetUrl('/secret')).toThrow();
  });
});
