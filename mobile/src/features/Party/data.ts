import { fetchOrganizations as fetchDirectoryOrganizations } from '@/lib/api/directories';

import type { Organization } from './types';

export const PARTY_PAGE_SIZE = 15;
export type SocialPlatform =
  | 'facebook'
  | 'instagram'
  | 'telegram'
  | 'x'
  | 'youtube';

export interface PartyFilters {
  category: string;
  city: string;
  country: string;
  language: string;
  search: string;
}

export async function fetchOrganizations(
  signal?: AbortSignal,
): Promise<Organization[]> {
  return fetchDirectoryOrganizations({ signal });
}

export function formatSocialUrl(
  platform: SocialPlatform,
  handle: string,
): string {
  if (!handle) {
    return '';
  }
  if (handle.startsWith('http')) {
    return handle;
  }

  const cleanHandle = handle.replace(/^@/, '');
  const origins: Record<SocialPlatform, string> = {
    facebook: 'https://facebook.com/',
    instagram: 'https://instagram.com/',
    telegram: 'https://t.me/',
    x: 'https://x.com/',
    youtube: 'https://youtube.com/',
  };
  return `${origins[platform]}${cleanHandle}`;
}

export function getLanguageName(code: string): string {
  const languages: Record<string, string> = {
    AR: 'العربية',
    EN: 'English',
    KU: 'Kurdish',
    TR: 'Turkish',
  };
  return languages[code] ?? code;
}

export function getPartyFilterOptions(
  organizations: readonly Organization[],
  field: 'city' | 'country' | 'lang' | 'type',
): string[] {
  return [
    ...new Set(
      organizations
        .map((organization) => organization[field])
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort();
}

// The source applies no client sort: organizations stay in server order.
export function filterOrganizations(
  organizations: readonly Organization[],
  filters: PartyFilters,
): Organization[] {
  const term = filters.search.toLowerCase();
  return organizations.filter((organization) => {
    const searchMatches =
      !term ||
      organization.name.toLowerCase().includes(term) ||
      organization.description?.toLowerCase().includes(term) ||
      organization.formattedLocation?.toLowerCase().includes(term) ||
      organization.type?.toLowerCase().includes(term);
    return (
      searchMatches &&
      (filters.category === 'all' || organization.type === filters.category) &&
      (filters.country === 'all' ||
        organization.country === filters.country) &&
      (filters.city === 'all' || organization.city === filters.city) &&
      (filters.language === 'all' || organization.lang === filters.language)
    );
  });
}

/*
PORT STATUS
  source:     resources/js/Pages/Party/data.ts (127 lines)
  confidence: high
  todos:      0
  notes:      CSV parsing moved server-side, the source applies no client sort, and visible directory logic remains native.
*/
