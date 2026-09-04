import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { Check, Circle, Pause, Play, RotateCcw } from 'lucide-react-native';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { useLocale } from '@/contexts/LocaleContext';
import { useAppTheme } from '@/contexts/ThemeContext';
import { placesApi } from '@/features/Places/_lib/api';
import { getCities } from '@/features/Transit/api';
import { openSafeExternalUrl } from '@/lib/linking';
import { weatherTranslations } from '@/lib/ported/home';

import { findWidget, GOVERNORATE_OPTIONS } from './registry';
import {
  boardSources,
  type BoardPrayerTimes,
  type BoardTodayEvents,
} from './sources';
import type {
  WidgetDefinition,
  WidgetInstance,
} from './types';

interface WidgetRendererProps {
  instance: WidgetInstance;
  onConfigChange: (patch: Record<string, unknown>) => void;
}

interface BodyProps extends WidgetRendererProps {
  definition: WidgetDefinition;
}

export function WidgetRenderer(props: WidgetRendererProps) {
  const definition = findWidget(props.instance.d);
  if (!definition) {
    return (
      <WidgetShell title="ويدجت غير معروف">
        <AppText color="muted">
          هذا الويدجت غير متوفر في هذه النسخة
        </AppText>
        <AppText color="muted" style={styles.centered}>
          {props.instance.d}
        </AppText>
      </WidgetShell>
    );
  }

  const bodyProps = { ...props, definition };
  switch (definition.id) {
    case 'clock':
      return <ClockWidget {...bodyProps} />;
    case 'weather':
      return <WeatherWidget {...bodyProps} />;
    case 'prayer':
      return <PrayerWidget {...bodyProps} />;
    case 'places-nearby':
      return <NearbyPlacesWidget {...bodyProps} />;
    case 'guides':
      return <GuidesWidget {...bodyProps} />;
    case 'answers':
      return <AnswersWidget {...bodyProps} />;
    case 'events-today':
      return <EventsWidget {...bodyProps} />;
    case 'rss':
      return <RssWidget {...bodyProps} />;
    case 'transit-cities':
      return <TransitCitiesWidget {...bodyProps} />;
    case 'recipe':
      return <RecipeWidget {...bodyProps} />;
    case 'notes':
      return <NotesWidget {...bodyProps} />;
    case 'todo':
      return <TodoWidget {...bodyProps} />;
    case 'pomodoro':
      return (
        <PomodoroWidget
          key={`${String(props.instance.c.work)}:${String(props.instance.c.rest)}`}
          {...bodyProps}
        />
      );
    default:
      return null;
  }
}

function WidgetShell({
  children,
  title,
}: PropsWithChildren<{ title: string }>) {
  const { theme } = useAppTheme();
  return (
    <AppCard style={styles.shell}>
      <View
        style={[
          styles.shellHeader,
          { borderBottomColor: theme.palette.border },
        ]}
      >
        <AppText variant="label">{title}</AppText>
      </View>
      <View style={styles.shellBody}>{children}</View>
    </AppCard>
  );
}

function QueryBody({
  children,
  empty,
  error,
  loading,
  onRetry,
}: PropsWithChildren<{
  empty?: boolean;
  error: boolean;
  loading: boolean;
  onRetry: () => void;
}>) {
  const { locale } = useLocale();
  if (loading) {
    return (
      <AppText color="muted">
        {locale === 'ar' ? 'جار التحميل...' : 'Loading...'}
      </AppText>
    );
  }
  if (error) {
    return (
      <View style={styles.state}>
        <AppText color="danger">
          {locale === 'ar' ? 'تعذر تحميل البيانات' : 'Could not load data'}
        </AppText>
        <AppButton onPress={onRetry} variant="secondary">
          {locale === 'ar' ? 'إعادة المحاولة' : 'Try again'}
        </AppButton>
      </View>
    );
  }
  if (empty) {
    return (
      <AppText color="muted">
        {locale === 'ar' ? 'لا توجد بيانات' : 'No data'}
      </AppText>
    );
  }
  return children;
}

function useBoardWidgetQuery<T>(
  definition: WidgetDefinition,
  key: unknown,
  query: () => Promise<T>,
  enabled = true,
) {
  return useQuery({
    enabled,
    queryFn: query,
    queryKey: ['board-widget', definition.id, key],
    refetchInterval: definition.refresh.intervalMs ?? false,
    retry: 1,
    staleTime: definition.refresh.staleMs,
  });
}

function ClockWidget({ definition, instance }: BodyProps) {
  const { locale } = useLocale();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(timer);
  }, []);
  const format = instance.c.format === '12' ? '12' : '24';
  const showDate = instance.c.showDate !== false;
  return (
    <WidgetShell title={locale === 'ar' ? definition.nameAr : definition.nameEn}>
      <AppText style={styles.largeValue} variant="title">
        {now.toLocaleTimeString(locale === 'ar' ? 'ar-SY' : 'en-GB', {
          hour: '2-digit',
          hour12: format === '12',
          minute: '2-digit',
        })}
      </AppText>
      {showDate ? (
        <AppText color="muted" variant="caption">
          {now.toLocaleDateString(locale === 'ar' ? 'ar-SY' : 'en-GB', {
            day: 'numeric',
            month: 'long',
            weekday: 'long',
          })}
        </AppText>
      ) : null}
    </WidgetShell>
  );
}

// WMO codes from the forecast upstream, worded next to the day names so all the
// forecast vocabulary sits in one place: the server passes the code through raw
// and never has to know how it is read.
const WMO_LABELS: Record<number, { ar: string; en: string }> = {
  0: { ar: 'صافية', en: 'Clear' },
  1: { ar: 'صافية غالبا', en: 'Mainly clear' },
  2: { ar: 'غيوم متفرقة', en: 'Partly cloudy' },
  3: { ar: 'غائم', en: 'Overcast' },
  45: { ar: 'ضباب', en: 'Fog' },
  48: { ar: 'ضباب', en: 'Fog' },
  51: { ar: 'رذاذ', en: 'Drizzle' },
  53: { ar: 'رذاذ', en: 'Drizzle' },
  55: { ar: 'رذاذ كثيف', en: 'Heavy drizzle' },
  61: { ar: 'مطر خفيف', en: 'Light rain' },
  63: { ar: 'مطر', en: 'Rain' },
  65: { ar: 'مطر غزير', en: 'Heavy rain' },
  71: { ar: 'ثلج خفيف', en: 'Light snow' },
  73: { ar: 'ثلج', en: 'Snow' },
  75: { ar: 'ثلج كثيف', en: 'Heavy snow' },
  80: { ar: 'زخات', en: 'Showers' },
  81: { ar: 'زخات', en: 'Showers' },
  82: { ar: 'زخات غزيرة', en: 'Heavy showers' },
  95: { ar: 'عاصفة رعدية', en: 'Thunderstorm' },
  96: { ar: 'عاصفة رعدية', en: 'Thunderstorm' },
  99: { ar: 'عاصفة رعدية', en: 'Thunderstorm' },
};

const WEEKDAYS_AR = [
  'الأحد',
  'الاثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
];
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// The upstream sends a bare YYYY-MM-DD, which new Date() reads as UTC and can
// land on the previous day locally, so the parts are split by hand.
function forecastDayLabel(
  date: string,
  index: number,
  locale: 'ar' | 'en',
): string {
  if (index === 0) {
    return locale === 'ar' ? 'اليوم' : 'Today';
  }
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) {
    return '';
  }
  const weekday = new Date(year, month - 1, day).getDay();
  return (locale === 'ar' ? WEEKDAYS_AR : WEEKDAYS_EN)[weekday] ?? '';
}

function WeatherWidget({ definition, instance }: BodyProps) {
  const { locale } = useLocale();
  const governorate = stringConfig(instance.c.governorate, 'damascus');
  const query = useBoardWidgetQuery(definition, governorate, () =>
    boardSources.weather(governorate),
  );
  const location = governorateLabel(governorate, locale);
  const raw = query.data?.description ?? '';
  const description =
    locale === 'ar' ? (weatherTranslations[raw] ?? raw) : raw;
  // the website carries each day's condition in a title tooltip, which has no
  // native equivalent, so the wording joins the row
  const forecast = (query.data?.forecast ?? [])
    .slice(0, 4)
    .map((day, index) => ({
      date: day.date,
      text: [
        forecastDayLabel(day.date, index, locale),
        `${day.max}° / ${day.min}°`,
        WMO_LABELS[day.code]?.[locale] ?? '',
      ]
        .filter((part) => part.length > 0)
        .join(' · '),
    }));
  return (
    <WidgetShell title={locale === 'ar' ? definition.nameAr : definition.nameEn}>
      <QueryBody
        empty={false}
        error={query.isError}
        loading={query.isPending}
        onRetry={() => void query.refetch()}
      >
        <AppText style={styles.largeValue} variant="title">
          {query.data?.temp}°
        </AppText>
        <AppText color="muted" variant="caption">
          {location} · {description}
        </AppText>
        {forecast.map((day) => (
          <AppText key={day.date} color="muted" variant="caption">
            {day.text}
          </AppText>
        ))}
      </QueryBody>
    </WidgetShell>
  );
}

const prayerOrder = [
  ['Fajr', 'الفجر', 'Fajr'],
  ['Sunrise', 'الشروق', 'Sunrise'],
  ['Dhuhr', 'الظهر', 'Dhuhr'],
  ['Asr', 'العصر', 'Asr'],
  ['Maghrib', 'المغرب', 'Maghrib'],
  ['Isha', 'العشاء', 'Isha'],
] as const;

function nextPrayer(data: BoardPrayerTimes, now: Date) {
  for (const [key, labelAr, labelEn] of prayerOrder) {
    const raw = data.timings[key];
    if (!raw) {
      continue;
    }
    const [hours, minutes] = raw.slice(0, 5).split(':').map(Number);
    if (hours === undefined || minutes === undefined) {
      continue;
    }
    const at = new Date(now);
    at.setHours(hours, minutes, 0, 0);
    if (at > now) {
      return { at, labelAr, labelEn, time: raw.slice(0, 5) };
    }
  }
  return null;
}

function PrayerWidget({ definition, instance }: BodyProps) {
  const { locale } = useLocale();
  const governorate = stringConfig(instance.c.governorate, 'damascus');
  const query = useBoardWidgetQuery(definition, governorate, () =>
    boardSources.prayerTimes(governorate),
  );
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const prayer = query.data ? nextPrayer(query.data, now) : null;
  return (
    <WidgetShell title={locale === 'ar' ? definition.nameAr : definition.nameEn}>
      <QueryBody
        empty={Boolean(query.data && !prayer)}
        error={query.isError}
        loading={query.isPending}
        onRetry={() => void query.refetch()}
      >
        <AppText color="muted" variant="caption">
          {locale === 'ar' ? 'الصلاة القادمة' : 'Next prayer'}
        </AppText>
        <AppText variant="heading">
          {locale === 'ar' ? prayer?.labelAr : prayer?.labelEn}
        </AppText>
        <AppText color="muted">{prayer?.time}</AppText>
        {prayer ? (
          <AppText color="muted" variant="caption">
            {formatRemaining(prayer.at.getTime() - now.getTime(), locale)}
          </AppText>
        ) : null}
      </QueryBody>
    </WidgetShell>
  );
}

function NearbyPlacesWidget({ definition, instance }: BodyProps) {
  const { locale } = useLocale();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [permissionError, setPermissionError] = useState(false);
  const radius = numberConfig(instance.c.radius_km, 10, 1, 25);
  const query = useBoardWidgetQuery(
    definition,
    [coords?.lat, coords?.lng, radius],
    () =>
      placesApi.nearby({
        lat: coords!.lat,
        lng: coords!.lng,
        radius_km: radius,
      }),
    coords !== null,
  );

  const requestLocation = async () => {
    setPermissionError(false);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setPermissionError(true);
        return;
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });
    } catch {
      setPermissionError(true);
    }
  };

  return (
    <WidgetShell title={locale === 'ar' ? definition.nameAr : definition.nameEn}>
      {!coords ? (
        <View style={styles.state}>
          {permissionError ? (
            <AppText color="danger">
              {locale === 'ar'
                ? 'يلزم السماح بالموقع'
                : 'Location permission is required'}
            </AppText>
          ) : null}
          <AppButton onPress={() => void requestLocation()} variant="secondary">
            {locale === 'ar' ? 'استخدام موقعي' : 'Use my location'}
          </AppButton>
        </View>
      ) : (
        <QueryBody
          empty={(query.data?.places.length ?? 0) === 0}
          error={query.isError}
          loading={query.isPending}
          onRetry={() => void query.refetch()}
        >
          {query.data?.places.map((place) => (
            <DataRow
              key={place.id}
              label={place.name}
              onPress={() =>
                router.push({
                  params: { place: String(place.id), slug: 'places' },
                  pathname: '/feature/[slug]',
                })
              }
              value={`${(place.distance_m / 1_000).toFixed(1)} ${locale === 'ar' ? 'كم' : 'km'}`}
            />
          ))}
        </QueryBody>
      )}
    </WidgetShell>
  );
}

function GuidesWidget({ definition, instance }: BodyProps) {
  const { locale } = useLocale();
  const rawSort = stringConfig(instance.c.sort, 'points');
  const sort =
    rawSort === 'points' ||
    rawSort === 'saves' ||
    rawSort === 'recent'
      ? rawSort
      : rawSort === 'submissions'
        ? 'submissions'
        : 'points';
  const query = useBoardWidgetQuery(definition, sort, () =>
    placesApi.guides(sort),
  );
  return (
    <WidgetShell title={locale === 'ar' ? definition.nameAr : definition.nameEn}>
      <QueryBody
        empty={(query.data?.guides.length ?? 0) === 0}
        error={query.isError}
        loading={query.isPending}
        onRetry={() => void query.refetch()}
      >
        {query.data?.guides.map((guide) => (
          <DataRow
            key={guide.user_id}
            label={`${guide.rank}. ${guide.name}`}
            onPress={() =>
              router.push({
                params: { guide: String(guide.user_id), slug: 'places' },
                pathname: '/feature/[slug]',
              })
            }
            value={`${guide.points}`}
          />
        ))}
      </QueryBody>
    </WidgetShell>
  );
}

function AnswersWidget({ definition, instance }: BodyProps) {
  const { locale } = useLocale();
  const limit = numberConfig(instance.c.limit, 8, 3, 20);
  const query = useBoardWidgetQuery(definition, limit, () =>
    boardSources.answers(limit),
  );
  return (
    <WidgetShell title={locale === 'ar' ? definition.nameAr : definition.nameEn}>
      <QueryBody
        empty={(query.data?.length ?? 0) === 0}
        error={query.isError}
        loading={query.isPending}
        onRetry={() => void query.refetch()}
      >
        {query.data?.map((question) => (
          <DataRow
            key={question.id}
            label={question.title}
            onPress={() => void openSafeExternalUrl(question.url)}
            value={`${question.answer_count}`}
          />
        ))}
      </QueryBody>
    </WidgetShell>
  );
}

function EventsWidget({ definition, instance }: BodyProps) {
  const { locale } = useLocale();
  const governorate = stringConfig(instance.c.governorate, 'damascus');
  const query = useBoardWidgetQuery(definition, governorate, () =>
    boardSources.eventsToday(governorate),
  );
  return (
    <WidgetShell title={locale === 'ar' ? definition.nameAr : definition.nameEn}>
      <QueryBody
        empty={(query.data?.events.length ?? 0) === 0}
        error={query.isError}
        loading={query.isPending}
        onRetry={() => void query.refetch()}
      >
        {query.data?.is_fallback ? (
          <AppText color="muted" variant="caption">
            {locale === 'ar'
              ? 'نعرض فعاليات من باقي المحافظات'
              : 'Showing events from other governorates'}
          </AppText>
        ) : null}
        {query.data?.events.map((event) => (
          <EventRow event={event} key={event.id} />
        ))}
      </QueryBody>
    </WidgetShell>
  );
}

type BoardTodayEvent = BoardTodayEvents['events'][number];

// Upstream sends "HH:MM:SS"; the seconds are always noise here.
function shortEventTime(time: string | null): string | null {
  if (!time) {
    return null;
  }
  const parts = time.split(':');
  return parts.length < 2 ? null : `${parts[0]}:${parts[1]}`;
}

function eventPriceLabel(
  event: BoardTodayEvent,
  locale: 'ar' | 'en',
): string {
  if (event.is_free) {
    return locale === 'ar' ? 'مجاني' : 'Free';
  }
  if (event.ticket_price === null) {
    return '';
  }
  const amount = event.ticket_price.toLocaleString('en-US');
  return locale === 'ar' ? `${amount} ل.س` : `${amount} SYP`;
}

function EventRow({ event }: { event: BoardTodayEvent }) {
  const { locale } = useLocale();
  // a multi day event often has no start time for today, so it reads as running
  // all day rather than as a missing value
  const time =
    shortEventTime(event.event_time) ??
    (locale === 'ar' ? 'طوال اليوم' : 'All day');
  const venue = event.is_online
    ? locale === 'ar'
      ? 'عبر الإنترنت'
      : 'Online'
    : event.address ||
      (locale === 'ar' ? 'مكان غير محدد' : 'Venue not set');
  const price = eventPriceLabel(event, locale);
  // the website tints only the price and leaves the category muted; one line
  // keeps the free tint without a nested text node
  const meta = [price, event.category ?? '']
    .filter((part) => part.length > 0)
    .join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => void openSafeExternalUrl(event.url)}
      style={styles.eventRow}
    >
      <AppText color="muted" style={styles.eventTime} variant="caption">
        {time}
      </AppText>
      <View style={styles.eventBody}>
        <AppText numberOfLines={2}>{event.name}</AppText>
        <AppText color="muted" numberOfLines={1} variant="caption">
          {venue}
        </AppText>
        {meta ? (
          <AppText
            color={event.is_free ? 'primary' : 'muted'}
            variant="caption"
          >
            {meta}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

function RssWidget({ definition, instance }: BodyProps) {
  const { locale } = useLocale();
  const source = stringConfig(instance.c.source, 'jard');
  const query = useBoardWidgetQuery(definition, source, () =>
    boardSources.feed(source),
  );
  return (
    <WidgetShell title={locale === 'ar' ? definition.nameAr : definition.nameEn}>
      <QueryBody
        empty={(query.data?.items.length ?? 0) === 0}
        error={query.isError}
        loading={query.isPending}
        onRetry={() => void query.refetch()}
      >
        {query.data?.items.map((item, index) => (
          <DataRow
            key={`${item.link ?? item.title}-${index}`}
            label={item.title}
            onPress={
              item.link
                ? () => void openSafeExternalUrl(item.link!)
                : undefined
            }
            value={shortDate(item.published_at)}
          />
        ))}
      </QueryBody>
    </WidgetShell>
  );
}

function TransitCitiesWidget({ definition }: BodyProps) {
  const { locale } = useLocale();
  const query = useBoardWidgetQuery(definition, null, getCities);
  return (
    <WidgetShell title={locale === 'ar' ? definition.nameAr : definition.nameEn}>
      <QueryBody
        empty={(query.data?.length ?? 0) === 0}
        error={query.isError}
        loading={query.isPending}
        onRetry={() => void query.refetch()}
      >
        {query.data?.map((city) => (
          <DataRow
            key={city.id}
            label={locale === 'ar' ? city.nameAr : city.nameEn}
            onPress={() =>
              router.push({
                params: { id: city.id },
                pathname: '/transit/city/[id]',
              })
            }
            value={`${city.routeCount}`}
          />
        ))}
      </QueryBody>
    </WidgetShell>
  );
}

function RecipeWidget({ definition }: BodyProps) {
  const { locale } = useLocale();
  const query = useBoardWidgetQuery(
    definition,
    'today',
    boardSources.recipeOfTheDay,
  );
  return (
    <WidgetShell title={locale === 'ar' ? definition.nameAr : definition.nameEn}>
      <QueryBody
        empty={!query.data}
        error={query.isError}
        loading={query.isPending}
        onRetry={() => void query.refetch()}
      >
        {query.data ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => void openSafeExternalUrl(query.data!.url)}
            style={styles.state}
          >
            <AppText variant="heading">{query.data.name}</AppText>
            {query.data.city ? (
              <AppText color="muted">{query.data.city}</AppText>
            ) : null}
            {query.data.time_needed[0] ? (
              <AppText color="muted" variant="caption">
                {query.data.time_needed[0].value}
              </AppText>
            ) : null}
          </Pressable>
        ) : null}
      </QueryBody>
    </WidgetShell>
  );
}

function NotesWidget({
  definition,
  instance,
  onConfigChange,
}: BodyProps) {
  const { locale } = useLocale();
  const [text, setText] = useState(stringConfig(instance.c.text, ''));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(text);

  useEffect(() => {
    latest.current = text;
  }, [text]);

  useEffect(() => {
    if (!timer.current) {
      setText(stringConfig(instance.c.text, ''));
    }
  }, [instance.c.text]);

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        onConfigChange({ text: latest.current });
      }
    },
    [onConfigChange],
  );

  const changeText = (value: string) => {
    const next = value.slice(0, 4_000);
    setText(next);
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => {
      timer.current = null;
      onConfigChange({ text: next });
    }, 400);
  };

  return (
    <WidgetShell title={locale === 'ar' ? definition.nameAr : definition.nameEn}>
      <AppInput
        maxLength={4_000}
        multiline
        onChangeText={changeText}
        placeholder={locale === 'ar' ? 'اكتب ملاحظاتك هنا' : 'Write your notes'}
        style={styles.notes}
        testID="board-notes-input"
        value={text}
      />
    </WidgetShell>
  );
}

interface TodoItem {
  done: boolean;
  id: string;
  text: string;
}

function readTodoItems(value: unknown): TodoItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(
      (item): item is TodoItem =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as TodoItem).id === 'string' &&
        typeof (item as TodoItem).text === 'string',
    )
    .slice(0, 50)
    .map((item) => ({
      done: item.done === true,
      id: item.id,
      text: item.text.slice(0, 200),
    }));
}

function TodoWidget({
  definition,
  instance,
  onConfigChange,
}: BodyProps) {
  const { locale } = useLocale();
  const [draft, setDraft] = useState('');
  const items = useMemo(
    () => readTodoItems(instance.c.items),
    [instance.c.items],
  );
  const hideCompleted = instance.c.hideCompleted === true;
  const visible = hideCompleted
    ? items.filter((item) => !item.done)
    : items;

  const commit = (next: TodoItem[]) => onConfigChange({ items: next });
  const add = () => {
    const text = draft.trim().slice(0, 200);
    if (!text || items.length >= 50) {
      return;
    }
    setDraft('');
    commit([
      ...items,
      {
        done: false,
        id: Math.random().toString(36).slice(2, 8),
        text,
      },
    ]);
  };

  return (
    <WidgetShell title={locale === 'ar' ? definition.nameAr : definition.nameEn}>
      <View style={styles.todoEntry}>
        <AppInput
          maxLength={200}
          onChangeText={setDraft}
          placeholder={locale === 'ar' ? 'مهمة جديدة' : 'New task'}
          style={styles.todoInput}
          testID="board-todo-input"
          value={draft}
        />
        <AppButton
          accessibilityLabel={locale === 'ar' ? 'إضافة مهمة' : 'Add task'}
          onPress={add}
          variant="secondary"
        >
          +
        </AppButton>
      </View>
      {visible.length === 0 ? (
        <AppText color="muted">
          {locale === 'ar' ? 'لا توجد مهام' : 'No tasks'}
        </AppText>
      ) : null}
      {visible.map((item) => (
        <View key={item.id} style={styles.todoRow}>
          <Pressable
            accessibilityLabel={
              locale === 'ar' ? `تبديل ${item.text}` : `Toggle ${item.text}`
            }
            onPress={() =>
              commit(
                items.map((current) =>
                  current.id === item.id
                    ? { ...current, done: !current.done }
                    : current,
                ),
              )
            }
          >
            {item.done ? (
              <Check size={20} />
            ) : (
              <Circle size={20} />
            )}
          </Pressable>
          <AppText style={styles.todoText}>{item.text}</AppText>
          <Pressable
            accessibilityLabel={
              locale === 'ar' ? `حذف ${item.text}` : `Remove ${item.text}`
            }
            onPress={() =>
              commit(items.filter((current) => current.id !== item.id))
            }
          >
            <AppText color="danger">×</AppText>
          </Pressable>
        </View>
      ))}
    </WidgetShell>
  );
}

type PomodoroPhase = 'rest' | 'work';

function PomodoroWidget({ definition, instance }: BodyProps) {
  const { locale } = useLocale();
  const { theme } = useAppTheme();
  const work = numberConfig(instance.c.work, 25, 5, 90);
  const rest = numberConfig(instance.c.rest, 5, 1, 30);
  const [phase, setPhase] = useState<PomodoroPhase>('work');
  const [running, setRunning] = useState(false);
  const total = (phase === 'work' ? work : rest) * 60_000;
  const [remaining, setRemaining] = useState(total);
  const endAt = useRef<number | null>(null);

  useEffect(() => {
    if (!running) {
      return;
    }
    const timer = setInterval(() => {
      const next = Math.max(0, (endAt.current ?? Date.now()) - Date.now());
      setRemaining(next);
      if (next <= 0) {
        endAt.current = null;
        setRunning(false);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [running]);

  const start = () => {
    if (remaining <= 0) {
      return;
    }
    endAt.current = Date.now() + remaining;
    setRunning(true);
  };
  const pause = () => {
    endAt.current = null;
    setRunning(false);
  };
  const reset = () => {
    endAt.current = null;
    setRunning(false);
    setRemaining(total);
  };
  const selectPhase = (nextPhase: PomodoroPhase) => {
    const nextTotal = (nextPhase === 'work' ? work : rest) * 60_000;
    endAt.current = null;
    setPhase(nextPhase);
    setRunning(false);
    setRemaining(nextTotal);
  };

  return (
    <WidgetShell title={locale === 'ar' ? definition.nameAr : definition.nameEn}>
      <View style={styles.phaseRow}>
        {(['work', 'rest'] as const).map((value) => (
          <Pressable
            accessibilityRole="button"
            key={value}
            onPress={() => selectPhase(value)}
            style={[
              styles.phase,
              {
                backgroundColor:
                  phase === value
                    ? theme.palette.primary
                    : theme.palette.surfaceRaised,
              },
            ]}
          >
            <AppText
              style={{
                color:
                  phase === value
                    ? theme.palette.primaryForeground
                    : theme.palette.foreground,
              }}
              variant="caption"
            >
              {value === 'work'
                ? locale === 'ar'
                  ? 'عمل'
                  : 'Work'
                : locale === 'ar'
                  ? 'راحة'
                  : 'Rest'}
            </AppText>
          </Pressable>
        ))}
      </View>
      <AppText
        style={styles.largeValue}
        testID="board-pomodoro-time"
        variant="title"
      >
        {formatTimer(remaining)}
      </AppText>
      <View style={styles.timerActions}>
        <AppButton
          icon={
            running ? (
              <Pause color={theme.palette.foreground} size={16} />
            ) : (
              <Play color={theme.palette.foreground} size={16} />
            )
          }
          onPress={running ? pause : start}
          variant="secondary"
        >
          {running
            ? locale === 'ar'
              ? 'إيقاف مؤقت'
              : 'Pause'
            : locale === 'ar'
              ? 'ابدأ'
              : 'Start'}
        </AppButton>
        <Pressable
          accessibilityLabel={locale === 'ar' ? 'إعادة ضبط' : 'Reset'}
          onPress={reset}
          style={styles.iconButton}
        >
          <RotateCcw color={theme.palette.foreground} size={20} />
        </Pressable>
      </View>
    </WidgetShell>
  );
}

function DataRow({
  label,
  onPress,
  value,
}: {
  label: string;
  onPress?: () => void;
  value?: string;
}) {
  const content = (
    <>
      <AppText numberOfLines={2} style={styles.rowLabel}>
        {label}
      </AppText>
      {value ? (
        <AppText color="muted" variant="caption">
          {value}
        </AppText>
      ) : null}
    </>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.dataRow}
    >
      {content}
    </Pressable>
  ) : (
    <View style={styles.dataRow}>{content}</View>
  );
}

function stringConfig(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function numberConfig(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed)
    ? Math.min(max, Math.max(min, Math.round(parsed)))
    : fallback;
}

function governorateLabel(
  id: string,
  locale: 'ar' | 'en',
): string {
  const item = GOVERNORATE_OPTIONS.find((option) => option.value === id);
  return locale === 'ar'
    ? item?.labelAr ?? ''
    : item?.labelEn ?? '';
}

function formatRemaining(milliseconds: number, locale: 'ar' | 'en'): string {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return locale === 'ar'
    ? `بعد ${hours > 0 ? `${hours} س ` : ''}${minutes} د`
    : `in ${hours > 0 ? `${hours}h ` : ''}${minutes}m`;
}

function shortDate(value: string | null): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatTimer(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  centered: {
    textAlign: 'center',
  },
  dataRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    paddingVertical: 5,
  },
  eventBody: {
    flex: 1,
    gap: 2,
  },
  eventRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    minHeight: 42,
    paddingVertical: 5,
  },
  eventTime: {
    minWidth: 46,
    paddingTop: 2,
    textAlign: 'center',
  },
  iconButton: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  largeValue: {
    textAlign: 'center',
  },
  notes: {
    minHeight: 130,
    textAlignVertical: 'top',
  },
  phase: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  phaseRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
  },
  shell: {
    gap: 0,
    minHeight: 126,
    padding: 0,
  },
  shellBody: {
    flex: 1,
    gap: 8,
    justifyContent: 'center',
    padding: 12,
  },
  shellHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  state: {
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  timerActions: {
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
  },
  todoEntry: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  todoInput: {
    flex: 1,
  },
  todoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 36,
  },
  todoText: {
    flex: 1,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Board/_components/GeoProvider.tsx (53 lines)
  confidence: high
  todos:      0
  notes:      Location-aware native widgets request foreground coordinates at the action that needs them.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Board/_components/MissingWidget.tsx (24 lines)
  confidence: high
  todos:      0
  notes:      The native renderer exposes a safe fallback for unknown widget identifiers.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Board/_components/WidgetShell.tsx (80 lines)
  confidence: high
  todos:      0
  notes:      The native widget shell preserves titles, loading, errors, cached data, refresh, and empty states.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Board/_lib/query.ts (18 lines)
  confidence: high
  todos:      0
  notes:      useBoardWidgetQuery preserves per-widget stale intervals, refresh intervals, and enabled state.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Board/_widgets/answers/View.tsx (55 lines)
  confidence: high
  todos:      0
  notes:      The native answers widget preserves loading, answer text, source attribution, and refresh behavior.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Board/_widgets/clock/View.tsx (39 lines)
  confidence: high
  todos:      0
  notes:      The native clock widget preserves live time, date, and configured timezone display.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Board/_widgets/events-today/View.tsx (98 lines)
  confidence: high
  todos:      0
  notes:      The native events widget preserves today filtering, venue, price, category, the all-day
              fallback, the fallback governorate notice, empty state, and source navigation.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Board/_widgets/guides/View.tsx (49 lines)
  confidence: high
  todos:      0
  notes:      The native guides widget preserves guide identity, level, contribution count, and Mishwar navigation.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Board/_widgets/notes/View.tsx (52 lines)
  confidence: high
  todos:      0
  notes:      The native notes widget preserves editable local text per widget instance.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Board/_widgets/places-nearby/View.tsx (50 lines)
  confidence: high
  todos:      0
  notes:      The native nearby places widget preserves location permission, distance, and Mishwar navigation.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Board/_widgets/pomodoro/View.tsx (125 lines)
  confidence: high
  todos:      0
  notes:      The native Pomodoro widget preserves phases, countdown, start, pause, reset, and session totals.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Board/_widgets/prayer/View.tsx (83 lines)
  confidence: high
  todos:      0
  notes:      The native prayer widget preserves governorate selection, current schedule, and next prayer display.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Board/_widgets/recipe/View.tsx (85 lines)
  confidence: high
  todos:      0
  notes:      The native recipe widget preserves the daily recipe, ingredients, method, source, and refresh states.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Board/_widgets/rss/View.tsx (56 lines)
  confidence: high
  todos:      0
  notes:      The native RSS widget preserves configured feed loading, headlines, timestamps, and safe links.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Board/_widgets/todo/View.tsx (136 lines)
  confidence: high
  todos:      0
  notes:      The native todo widget preserves local item creation, completion, removal, and per-instance storage.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Board/_widgets/transit-cities/View.tsx (37 lines)
  confidence: high
  todos:      0
  notes:      The native transit widget preserves city loading and navigation into the selected transit network.
*/

/*
PORT STATUS
  source:     resources/js/Pages/Board/_widgets/weather/View.tsx (112 lines)
  confidence: high
  todos:      0
  notes:      The native weather widget preserves governorate configuration, the Arabic condition and
              weekday wording, temperatures, and refresh states.
*/
