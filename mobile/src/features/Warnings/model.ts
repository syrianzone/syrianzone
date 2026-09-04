/**
 * Emergency warnings model. jard's news page has no JSON API, so the app and
 * the backend share one parsing strategy: read the Inertia data-page
 * attribute, undo the HTML escaping Blade added, and keep rows whose feed
 * category is "warnings". Everything here is pure so one saved page can drive
 * tests on both sides and so the notification checker can reason about
 * "new" without touching the network. Times are compared as epoch numbers
 * because the backend emits "+00:00" offsets while the fallback emits "Z".
 */
import { z } from 'zod';

export const warningSourceSchema = z.object({
  color: z.string(),
  name: z.string(),
  slug: z.string(),
});

export const warningItemSchema = z.object({
  description: z.string(),
  id: z.string().min(1),
  link: z.string(),
  published_at: z.string().min(1),
  source: warningSourceSchema,
  title: z.string().min(1),
});

export type WarningItem = z.infer<typeof warningItemSchema>;

export const MAX_WARNINGS = 50;
export const FRESH_WINDOW_MS = 24 * 60 * 60 * 1000;
const DEFAULT_COLOR = '#ef4444';

const jardRowSchema = z.object({
  description: z.string().nullable().optional(),
  feed: z.object({
    category: z.string(),
    color: z.string().nullable().optional(),
    name: z.string(),
    slug: z.string(),
  }),
  id: z.union([z.number(), z.string()]),
  link: z.string(),
  pub_date: z.string(),
  title: z.string(),
});

const jardPageSchema = z.object({
  props: z.object({
    items: z.object({ data: z.array(z.unknown()) }),
  }),
});

const namedEntities: Record<string, string> = {
  '&amp;': '&',
  '&gt;': '>',
  '&lt;': '<',
  '&quot;': '"',
};

// Single pass on purpose: "&amp;lt;" must become "&lt;", never "<".
export function decodeHtmlEntities(value: string): string {
  return value.replace(
    /&(?:amp|lt|gt|quot|#\d+|#x[0-9a-fA-F]+);/g,
    (entity) => {
      const named = namedEntities[entity];
      if (named !== undefined) {
        return named;
      }
      const code = entity.startsWith('&#x')
        ? Number.parseInt(entity.slice(3, -1), 16)
        : Number.parseInt(entity.slice(2, -1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : entity;
    },
  );
}

export function publishedTime(item: Pick<WarningItem, 'published_at'>): number {
  return Date.parse(item.published_at);
}

export function sortNewestFirst(items: readonly WarningItem[]): WarningItem[] {
  return [...items].sort((a, b) => publishedTime(b) - publishedTime(a));
}

export function parseJardPage(html: string): WarningItem[] {
  const match = /data-page="([^"]+)"/.exec(html);
  if (!match?.[1]) {
    throw new Error('No Inertia page data found.');
  }

  const page = jardPageSchema.parse(JSON.parse(decodeHtmlEntities(match[1])));
  const items: WarningItem[] = [];
  for (const row of page.props.items.data) {
    const parsed = jardRowSchema.safeParse(row);
    if (!parsed.success || parsed.data.feed.category !== 'warnings') {
      continue;
    }
    const published = Date.parse(parsed.data.pub_date);
    const title = parsed.data.title.trim();
    if (Number.isNaN(published) || !title) {
      continue;
    }
    items.push({
      description: (parsed.data.description ?? '').trim(),
      id: String(parsed.data.id),
      link: parsed.data.link,
      published_at: new Date(published).toISOString(),
      source: {
        color: parsed.data.feed.color ?? DEFAULT_COLOR,
        name: parsed.data.feed.name,
        slug: parsed.data.feed.slug,
      },
      title,
    });
  }
  return sortNewestFirst(items).slice(0, MAX_WARNINGS);
}

/** Items published strictly after the cursor. A null cursor keeps everything. */
export function newerThan(
  items: readonly WarningItem[],
  cursor: string | null,
): WarningItem[] {
  const cursorTime = cursor === null ? Number.NaN : Date.parse(cursor);
  if (Number.isNaN(cursorTime)) {
    return [...items];
  }
  return items.filter((item) => publishedTime(item) > cursorTime);
}

export function newestPublishedAt(
  items: readonly WarningItem[],
): string | null {
  return sortNewestFirst(items)[0]?.published_at ?? null;
}

export function isFresh(
  item: Pick<WarningItem, 'published_at'>,
  now: number,
): boolean {
  const time = publishedTime(item);
  return !Number.isNaN(time) && now - time < FRESH_WINDOW_MS;
}

/** Arabic count forms: [one, two, few (3-10), many (11+)]. */
type ArabicForms = readonly [string, string, string, string];

function arabicAgo(count: number, forms: ArabicForms): string {
  if (count === 1) {
    return `قبل ${forms[0]}`;
  }
  if (count === 2) {
    return `قبل ${forms[1]}`;
  }
  return `قبل ${count} ${count <= 10 ? forms[2] : forms[3]}`;
}

function englishAgo(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'} ago`;
}

const arabicUnits = {
  day: ['يوم', 'يومين', 'أيام', 'يومًا'],
  hour: ['ساعة', 'ساعتين', 'ساعات', 'ساعة'],
  minute: ['دقيقة', 'دقيقتين', 'دقائق', 'دقيقة'],
} as const satisfies Record<string, ArabicForms>;

/**
 * lib/ported/home.ts formatDuration is a clock readout (HH:MM:SS), which is
 * the wrong shape for "3 hours ago", so this stays local and dependency free.
 * Past thirty days the date itself reads better than a large count.
 */
export function formatRelativeTime(
  publishedAt: string,
  locale: 'ar' | 'en',
  now: number,
): string {
  const time = Date.parse(publishedAt);
  if (Number.isNaN(time)) {
    return '';
  }
  const minutes = Math.floor(Math.max(0, now - time) / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const isArabic = locale === 'ar';

  if (minutes < 1) {
    return isArabic ? 'الآن' : 'just now';
  }
  if (hours < 1) {
    return isArabic
      ? arabicAgo(minutes, arabicUnits.minute)
      : englishAgo(minutes, 'minute');
  }
  if (days < 1) {
    return isArabic
      ? arabicAgo(hours, arabicUnits.hour)
      : englishAgo(hours, 'hour');
  }
  if (days <= 30) {
    return isArabic ? arabicAgo(days, arabicUnits.day) : englishAgo(days, 'day');
  }
  return new Date(time).toISOString().slice(0, 10);
}

/*
PORT STATUS
  source:     none (new native feature; parser mirrors app/Services/PublicContent/WarningsFeedService.php)
  confidence: high
  todos:      0
  notes:      Pure parser, cursor helpers, and relative time shared by screen, banner, and notifications.
*/
