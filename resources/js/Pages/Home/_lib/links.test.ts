import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const saveAccountSettings = vi.fn();

vi.mock('@/Domain/settings/accountSettings', () => ({
  saveAccountSettings: (patch: unknown) => saveAccountSettings(patch),
}));

import { readCustomLinks, saveCustomLinks, type CustomLink } from './links';

/** A stand-in for the browser's storage: the module is the only writer. */
function installStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => { data.set(key, value); },
    },
  });
  return data;
}

const LINK: CustomLink = { id: 'a', name: 'الجزيرة', url: 'https://www.aljazeera.net' };

beforeEach(() => {
  saveAccountSettings.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('home custom links', () => {
  it('reads the account list when it holds one, even when the device holds another', () => {
    installStorage({ customLinks: JSON.stringify([LINK]) });
    const fromAccount = [{ id: 'b', url: 'https://example.com' }];

    expect(readCustomLinks({ customLinks: fromAccount })).toEqual(fromAccount);
  });

  it('falls back to the device copy, including an empty account list', () => {
    installStorage({ customLinks: JSON.stringify([LINK]) });

    expect(readCustomLinks({})).toEqual([LINK]);
    expect(readCustomLinks({ customLinks: [] })).toEqual([]);
  });

  it('starts with no links when the device value is corrupt', () => {
    installStorage({ customLinks: '{not json' });

    expect(readCustomLinks({})).toEqual([]);
  });

  it('writes the device copy and, when signed in, the account mirror', () => {
    const data = installStorage();

    saveCustomLinks([LINK], true);

    expect(JSON.parse(data.get('customLinks') ?? 'null')).toEqual([LINK]);
    expect(saveAccountSettings).toHaveBeenCalledWith({ customLinks: [LINK] });
  });

  it('leaves the account alone for a guest', () => {
    installStorage();

    saveCustomLinks([LINK], false);

    expect(saveAccountSettings).not.toHaveBeenCalled();
  });
});
