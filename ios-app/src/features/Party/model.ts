import type { Organization } from '../../../../resources/js/Pages/Party/types';
import { formatSocialUrl, getLanguageName } from '../../../../resources/js/Pages/Party/data';
import { matchesSearch } from '../../domain';
import { array, record, text } from '../../platform/validation';
export { formatSocialUrl, getLanguageName, type Organization };
const optionalFields = ['description', 'type', 'country', 'city', 'formattedLocation', 'socialX', 'socialInsta', 'socialFb', 'website', 'manifesto', 'email', 'phone', 'lang', 'mvpMembers', 'youtube', 'telegram'] as const;
export function decodePartyPage(payload: unknown): { items: Organization[]; fetchedAt: string | null } {
  const page = record(payload); const ids = new Set<string>();
  const items = array(page.initialOrganizations).map(entry => {
    const raw = record(entry); const id = text(raw.id); const name = text(raw.name);
    if (!id.trim() || !name.trim() || ids.has(id)) throw new Error('هوية المنظمة غير صالحة');
    ids.add(id); const item: Organization = { id, name };
    for (const field of optionalFields) if (raw[field] != null) item[field] = text(raw[field]);
    if (raw.politicalLeanings != null) item.politicalLeanings = array(raw.politicalLeanings).map(value => text(value));
    return item;
  });
  return { items, fetchedAt: page.fetchedAt == null ? null : text(page.fetchedAt) };
}
export function filterOrganizations(items: Organization[], query: string, filters: Record<string, string>): Organization[] {
  return items.filter(item => matchesSearch([item.name, item.description, item.formattedLocation, item.type].filter(Boolean).join(' '), query)
    && (!filters.category || item.type === filters.category) && (!filters.country || item.country === filters.country)
    && (!filters.city || item.city === filters.city) && (!filters.lang || item.lang === filters.lang));
}
// PORT STATUS: source resources/js/Pages/Party/PartyClient.tsx; confidence high; todos 0.
