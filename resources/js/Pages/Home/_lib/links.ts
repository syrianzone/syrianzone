import { saveAccountSettings, type AccountCustomLink } from '@/Domain/settings/accountSettings';

/**
 * The home screen's custom links: the account's list, the device copy of it, and
 * the write path both of them use.
 *
 * Home seeds the list on mount and its dialogs edit it; every write goes through
 * `saveCustomLinks`, so the device copy and the account mirror cannot disagree
 * and a change to how a link is stored is one edit. The stored shape is the one
 * `UserSettingsController` validates (`id` + `url` required, the three label keys
 * optional), which is also what older writes left in the account.
 */

export type CustomLink = AccountCustomLink;

const LINKS_KEY = 'customLinks';

/**
 * The account's links when it holds the key, else the device's. A corrupt device
 * value is no links: the page starts empty rather than failing.
 */
export function readCustomLinks(settings: Record<string, unknown> | null | undefined): CustomLink[] {
  const fromAccount = settings?.[LINKS_KEY];
  if (Array.isArray(fromAccount)) return fromAccount as CustomLink[];

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(LINKS_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CustomLink[]) : [];
  } catch {
    return [];
  }
}

/**
 * Persist the list on both sides: the device key always moves, so a signed-out
 * visit shows the same links, and the account mirror follows when `signedIn`.
 */
export function saveCustomLinks(links: CustomLink[], signedIn: boolean): void {
  try {
    window.localStorage.setItem(LINKS_KEY, JSON.stringify(links));
  } catch {
    // private mode: the session still works, nothing is persisted
  }
  if (signedIn) saveAccountSettings({ customLinks: links });
}
