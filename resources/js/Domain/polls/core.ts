import raw from '../../../data/polls.json';

/**
 * The poll behind /tierlist. Deleting or renaming this slug 404s the tier-list
 * pages, so the server guards it explicitly (`App\Models\Poll::coreSlug()`,
 * which reads the same file).
 */
export const CORE_POLL_SLUG: string = raw.core_slug;

/** The timezone a new poll starts with; the dashboard editor never exposes it. */
export const DEFAULT_POLL_TIMEZONE: string = raw.default_timezone;

export function isCorePollSlug(slug: string | null | undefined): boolean {
  return slug === CORE_POLL_SLUG;
}
