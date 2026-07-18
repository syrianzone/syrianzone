import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';

import { isSafeExternalUrl } from '@/lib/linking';

export type F3aliaLanguage = 'ar' | 'en';
export type F3aliaVariant = 'grid' | 'single';

const attachmentSchema = z.object({
  fileType: z.string(),
  fileUrl: z.string(),
});

const categorySchema = z.object({
  nameAr: z.string(),
  nameEn: z.string(),
});

const ownerSchema = z.object({
  logoImage: z.string().nullable(),
  organizerName: z.string(),
});

export const f3aliaEventSchema = z.object({
  address: z.string(),
  attachments: z.array(attachmentSchema).max(12).nullable(),
  category: categorySchema.nullable(),
  description: z.string(),
  endDate: z.string().nullable(),
  endTime: z.string().nullable(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  eventLink: z.string(),
  eventTime: z.string().nullable(),
  id: z.string(),
  isFree: z.boolean(),
  isOnline: z.boolean(),
  name: z.string(),
  owner: ownerSchema.nullable(),
  province: z.string(),
  provinceName: z.string(),
  ticketPrice: z.number(),
});

export type F3aliaEvent = z.infer<typeof f3aliaEventSchema>;

const pageSchema = z.object({
  events: z.array(f3aliaEventSchema).max(30),
  totalElements: z.number().int().nonnegative(),
});

export interface F3aliaPage {
  events: F3aliaEvent[];
  totalElements: number;
}

export interface F3aliaEventsResult extends F3aliaPage {
  cached: boolean;
  isShowingFallbackEvents: boolean;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

interface FetchF3aliaPageOptions {
  fetcher?: FetchLike;
  fromDate: string;
  province: string | null;
  signal?: AbortSignal;
  size: number;
}

interface LoadF3aliaEventsOptions {
  allProvinces?: boolean;
  fallbackToAll?: boolean;
  fetcher?: FetchLike;
  fromDate: string;
  governorate: string;
  signal?: AbortSignal;
  size: number;
}

const F3ALIA_ENDPOINT =
  'https://event-backend-production-18c4.up.railway.app/graphql';
const F3ALIA_CACHE_PREFIX = 'sz-f3alia-events-v1';
const REQUEST_TIMEOUT_MS = 12_000;

const EVENT_QUERY = `
  query GetEvents($province: Province, $fromDate: Date, $size: Int!) {
    getAllEventsForVisitor(page: 0, size: $size, province: $province, fromDate: $fromDate) {
      totalElements
      content {
        id
        name
        description
        address
        isOnline
        eventLink
        province
        provinceName
        isFree
        ticketPrice
        eventDate
        eventTime
        endDate
        endTime
        category { nameAr nameEn }
        owner { organizerName logoImage }
        attachments { fileUrl fileType }
      }
    }
  }
`;

const GOVERNORATE_TO_PROVINCE: Readonly<Record<string, string>> = {
  aleppo: 'ALEPPO',
  damascus: 'DAMASCUS',
  daraa: 'DARAA',
  'deir-ez-zor': 'DEIR_EZ_ZOR',
  hama: 'HAMA',
  hasakah: 'HASAKEH',
  homs: 'HOMS',
  idlib: 'IDLIB',
  latakia: 'LATTAKIA',
  quneitra: 'QUNEITRA',
  raqqa: 'RAQQA',
  'rural-damascus': 'DAMASCUS',
  sweida: 'AS_SUWAYDA',
  tartus: 'TARTOUS',
};

const PROVINCE_LABELS: Readonly<
  Record<string, { ar: string; en: string }>
> = {
  ALEPPO: { ar: 'حلب', en: 'Aleppo' },
  AS_SUWAYDA: { ar: 'السويداء', en: 'As-Suwayda' },
  DAMASCUS: { ar: 'دمشق', en: 'Damascus' },
  DARAA: { ar: 'درعا', en: 'Daraa' },
  DEIR_EZ_ZOR: { ar: 'دير الزور', en: 'Deir ez-Zor' },
  HAMA: { ar: 'حماة', en: 'Hama' },
  HASAKEH: { ar: 'الحسكة', en: 'Hasakah' },
  HOMS: { ar: 'حمص', en: 'Homs' },
  IDLIB: { ar: 'إدلب', en: 'Idlib' },
  LATTAKIA: { ar: 'اللاذقية', en: 'Lattakia' },
  QUNEITRA: { ar: 'القنيطرة', en: 'Quneitra' },
  RAQQA: { ar: 'الرقة', en: 'Raqqa' },
  TARTOUS: { ar: 'طرطوس', en: 'Tartous' },
};

export const GOVERNORATE_LABELS: Readonly<
  Record<string, { ar: string; en: string }>
> = {
  aleppo: { ar: 'حلب', en: 'Aleppo' },
  damascus: { ar: 'دمشق', en: 'Damascus' },
  daraa: { ar: 'درعا', en: 'Daraa' },
  'deir-ez-zor': { ar: 'دير الزور', en: 'Deir ez-Zor' },
  hama: { ar: 'حماة', en: 'Hama' },
  hasakah: { ar: 'الحسكة', en: 'Hasakah' },
  homs: { ar: 'حمص', en: 'Homs' },
  idlib: { ar: 'إدلب', en: 'Idlib' },
  latakia: { ar: 'اللاذقية', en: 'Latakia' },
  quneitra: { ar: 'القنيطرة', en: 'Quneitra' },
  raqqa: { ar: 'الرقة', en: 'Raqqa' },
  'rural-damascus': { ar: 'ريف دمشق', en: 'Rural Damascus' },
  sweida: { ar: 'السويداء', en: 'Sweida' },
  tartus: { ar: 'طرطوس', en: 'Tartus' },
};

function createRequestController(signal?: AbortSignal): {
  cleanup: () => void;
  signal: AbortSignal;
} {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, REQUEST_TIMEOUT_MS);
  return {
    cleanup: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    },
    signal: controller.signal,
  };
}

export function f3aliaProvinceForGovernorate(
  governorate: string,
): string | null {
  return GOVERNORATE_TO_PROVINCE[governorate] ?? null;
}

export function todayDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function fetchF3aliaPage({
  fetcher = fetch,
  fromDate,
  province,
  signal,
  size,
}: FetchF3aliaPageOptions): Promise<F3aliaPage> {
  const boundedSize = Math.min(30, Math.max(1, Math.trunc(size)));
  const request = createRequestController(signal);
  try {
    const response = await fetcher(F3ALIA_ENDPOINT, {
      body: JSON.stringify({
        query: EVENT_QUERY,
        variables: { fromDate, province, size: boundedSize },
      }),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
      signal: request.signal,
    });
    if (!response.ok) {
      throw new Error('f3alia_unavailable');
    }
    const payload = z
      .object({
        data: z
          .object({
            getAllEventsForVisitor: z.object({
              content: z.array(f3aliaEventSchema).max(30),
              totalElements: z.number().int().nonnegative(),
            }),
          })
          .nullable()
          .optional(),
        errors: z.array(z.unknown()).optional(),
      })
      .parse(await response.json());
    if (payload.errors?.length || !payload.data) {
      throw new Error('f3alia_unavailable');
    }
    return {
      events: payload.data.getAllEventsForVisitor.content,
      totalElements: payload.data.getAllEventsForVisitor.totalElements,
    };
  } catch {
    throw new Error('f3alia_unavailable');
  } finally {
    request.cleanup();
  }
}

function cacheKey(province: string | null, size: number): string {
  return `${F3ALIA_CACHE_PREFIX}:${province ?? 'all'}:${size}`;
}

async function readCachedPage(
  province: string | null,
  size: number,
): Promise<F3aliaPage | null> {
  try {
    const stored = await AsyncStorage.getItem(cacheKey(province, size));
    return stored ? pageSchema.parse(JSON.parse(stored)) : null;
  } catch {
    return null;
  }
}

async function fetchPageWithCache(
  options: FetchF3aliaPageOptions,
): Promise<F3aliaPage & { cached: boolean }> {
  const size = Math.min(30, Math.max(1, Math.trunc(options.size)));
  let page: F3aliaPage;
  try {
    page = await fetchF3aliaPage({ ...options, size });
  } catch {
    const cached = await readCachedPage(options.province, size);
    if (!cached) {
      throw new Error('f3alia_unavailable');
    }
    return { ...cached, cached: true };
  }
  try {
    await AsyncStorage.setItem(
      cacheKey(options.province, size),
      JSON.stringify(page),
    );
  } catch {
    return { ...page, cached: false };
  }
  return { ...page, cached: false };
}

export async function loadF3aliaEvents({
  allProvinces = false,
  fallbackToAll = true,
  fetcher,
  fromDate,
  governorate,
  signal,
  size,
}: LoadF3aliaEventsOptions): Promise<F3aliaEventsResult> {
  const selectedProvince = allProvinces
    ? null
    : f3aliaProvinceForGovernorate(governorate);
  const selected = await fetchPageWithCache({
    fetcher,
    fromDate,
    province: selectedProvince,
    signal,
    size,
  });
  if (
    selected.events.length > 0 ||
    selectedProvince === null ||
    !fallbackToAll
  ) {
    return {
      ...selected,
      isShowingFallbackEvents: false,
    };
  }

  const fallback = await fetchPageWithCache({
    fetcher,
    fromDate,
    province: null,
    signal,
    size,
  });
  return {
    ...fallback,
    isShowingFallbackEvents: true,
  };
}

export function displayEvents(
  events: readonly F3aliaEvent[],
  fromDate: string,
  variant: F3aliaVariant,
): F3aliaEvent[] {
  const sorted = events
    .filter((event) => event.eventDate >= fromDate)
    .sort((left, right) => {
      const leftKey = `${left.eventDate}T${left.eventTime ?? '99:99'}:${left.id}`;
      const rightKey = `${right.eventDate}T${right.eventTime ?? '99:99'}:${right.id}`;
      return leftKey.localeCompare(rightKey, 'en');
    });
  return variant === 'single' ? sorted.slice(0, 1) : sorted;
}

export function eventImageUrl(event: F3aliaEvent): string | null {
  const attachments = event.attachments ?? [];
  const attachment =
    attachments.find((item) => item.fileType === 'EVENT_IMAGE') ??
    attachments.find((item) => item.fileType === 'EVENT_SMALL_IMAGE') ??
    attachments[0];
  return attachment && isSafeExternalUrl(attachment.fileUrl)
    ? attachment.fileUrl
    : null;
}

export function eventDetailUrl(event: F3aliaEvent): string {
  return isSafeExternalUrl(event.eventLink)
    ? event.eventLink
    : `https://app.f3alia.com/?event_id=${encodeURIComponent(event.id)}`;
}

export function provinceLabel(
  event: F3aliaEvent,
  language: F3aliaLanguage,
): string {
  const translated = PROVINCE_LABELS[event.province]?.[language];
  if (translated) {
    return translated;
  }
  return language === 'ar' ? event.provinceName : event.provinceName || event.province;
}

export function eventFallbackColor(id: string): string {
  const colors = ['#6d28d9', '#059669', '#db2777', '#2563eb', '#d97706', '#7c3aed'];
  const parsed = Number.parseInt(id, 10);
  const index = Number.isFinite(parsed)
    ? Math.abs(parsed) % colors.length
    : Array.from(id).reduce((sum, character) => sum + character.charCodeAt(0), 0) % colors.length;
  return colors[index] ?? colors[0] ?? '#6d28d9';
}
