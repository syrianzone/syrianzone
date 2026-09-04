import {
  SYID_MATERIALS,
  SYID_MATERIALS_ZIP_URL,
  syidAssetUrl,
} from './files';

// Every /syid-assets/materials path the deployed website links to, verified with
// a HEAD request against production. The Arabic filenames this app used to
// hardcode are not in this list because production answers them with a 404.
const websiteMaterialUrls = [
  'https://syrian.zone/syid-assets/materials/blackonwhite.png',
  'https://syrian.zone/syid-assets/materials/logo.ai.svg',
  'https://syrian.zone/syid-assets/materials/qomra2.webp',
  'https://syrian.zone/syid-assets/materials/syrian-flag-guide.webp',
  'https://syrian.zone/syid-assets/materials/syrian-flag-proportions.png',
  'https://syrian.zone/syid-assets/materials/syrian-flag-proportions.svg',
  'https://syrian.zone/syid-assets/materials/syrian-flag.dwg',
  'https://syrian.zone/syid-assets/materials/whiteonblack.png',
];

describe('Syrian identity asset URLs', () => {
  test('every material resolves to a URL the website also uses', () => {
    for (const relativePath of Object.values(SYID_MATERIALS)) {
      expect(websiteMaterialUrls).toContain(syidAssetUrl(relativePath));
    }
  });

  test('the flag proportions card targets the three published flag files', () => {
    expect(syidAssetUrl(SYID_MATERIALS.flagProportionsPng)).toBe(
      'https://syrian.zone/syid-assets/materials/syrian-flag-proportions.png',
    );
    expect(syidAssetUrl(SYID_MATERIALS.flagProportionsSvg)).toBe(
      'https://syrian.zone/syid-assets/materials/syrian-flag-proportions.svg',
    );
    expect(syidAssetUrl(SYID_MATERIALS.flagDwg)).toBe(
      'https://syrian.zone/syid-assets/materials/syrian-flag.dwg',
    );
  });

  test('the identity bundle points at the R2 download the website links', () => {
    expect(SYID_MATERIALS_ZIP_URL).toBe(
      'https://pub-1d51b625c56e4fd085c58a79672e1b15.r2.dev/downloads/191b8f0d278fc2ab095fb4f344e3e9b4-vGF1L1.zip',
    );
  });

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
