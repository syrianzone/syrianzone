import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import {
  AlertCircle,
  Calendar,
  Clock,
  ExternalLink,
  MapPin,
  RefreshCw,
  Sparkles,
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';
import { openSafeExternalUrl } from '@/lib/linking';

import {
  displayEvents,
  eventDetailUrl,
  eventFallbackColor,
  eventImageUrl,
  GOVERNORATE_LABELS,
  loadF3aliaEvents,
  provinceLabel,
  todayDateString,
  type F3aliaEvent,
  type F3aliaEventsResult,
  type F3aliaLanguage,
  type F3aliaVariant,
} from './F3aliaEvents.model';

export interface F3aliaEventsProps {
  allProvinces?: boolean;
  enabled?: boolean;
  fallbackToAll?: boolean;
  governorate: string;
  language?: F3aliaLanguage;
  variant?: F3aliaVariant;
}

export interface F3aliaEventsState {
  data: F3aliaEventsResult | undefined;
  error: boolean;
  loading: boolean;
  refreshing: boolean;
  retry: () => void;
}

interface UseF3aliaEventsOptions {
  allProvinces?: boolean;
  enabled?: boolean;
  fallbackToAll?: boolean;
  governorate: string;
  size?: number;
  today?: string;
  variant?: F3aliaVariant;
}

export interface F3aliaEventsViewProps {
  governorate: string;
  language: F3aliaLanguage;
  showHeader?: boolean;
  state: F3aliaEventsState;
  variant: F3aliaVariant;
}

const F3ALIA_SOURCE = 'https://app.f3alia.com';

export function useF3aliaEvents({
  allProvinces = false,
  enabled = true,
  fallbackToAll = true,
  governorate,
  size,
  today = todayDateString(),
  variant = 'grid',
}: UseF3aliaEventsOptions): F3aliaEventsState {
  const query = useQuery({
    enabled,
    queryFn: async ({ signal }) => {
      const result = await loadF3aliaEvents({
        allProvinces,
        fallbackToAll,
        fromDate: today,
        governorate,
        signal,
        size: size ?? (variant === 'single' ? 3 : 30),
      });
      return {
        ...result,
        events: displayEvents(result.events, today, variant),
      };
    },
    queryKey: [
      'f3alia-events',
      governorate,
      allProvinces ? 'all' : 'selected',
      fallbackToAll ? 'fallback' : 'strict',
      variant,
      size,
      today,
    ],
  });
  const paused = query.fetchStatus === 'paused';
  return {
    data: query.data,
    error: !query.data && (query.isError || paused),
    loading: query.isPending && !paused,
    refreshing: query.isFetching && !query.isPending,
    retry: () => {
      void query.refetch();
    },
  };
}

export default function F3aliaEvents({
  allProvinces = false,
  enabled = true,
  fallbackToAll = true,
  governorate,
  language = 'ar',
  variant = 'grid',
}: F3aliaEventsProps) {
  const state = useF3aliaEvents({
    allProvinces,
    enabled,
    fallbackToAll,
    governorate,
    variant,
  });
  return (
    <F3aliaEventsView
      governorate={governorate}
      language={language}
      showHeader
      state={state}
      variant={variant}
    />
  );
}

export function F3aliaEventsView({
  governorate,
  language,
  showHeader = true,
  state,
  variant,
}: F3aliaEventsViewProps) {
  const { theme } = useAppTheme();
  const rtl = language === 'ar';
  const textStyle = {
    textAlign: rtl ? ('right' as const) : ('left' as const),
    writingDirection: rtl ? ('rtl' as const) : ('ltr' as const),
  };
  const rowDirection = rtl ? ('row-reverse' as const) : ('row' as const);
  const currentGovernorate =
    GOVERNORATE_LABELS[governorate]?.[language] ?? governorate;
  const events = state.data?.events ?? [];

  return (
    <View
      style={[styles.root, { direction: rtl ? 'rtl' : 'ltr' }]}
      testID="f3alia-events"
    >
      {variant === 'grid' && showHeader ? (
        <View style={styles.header}>
          <View style={[styles.titleRow, { flexDirection: rowDirection }]}>
            <Sparkles color={theme.palette.primary} size={20} />
            <AppText style={textStyle} variant="heading">
              {language === 'ar'
                ? `الفعاليات القادمة في ${currentGovernorate}`
                : `Upcoming Events in ${currentGovernorate}`}
            </AppText>
          </View>
          <AppText color="muted" style={textStyle} variant="caption">
            {language === 'ar'
              ? 'اكتشف الفعاليات، والمعارض، والأنشطة الثقافية والتعليمية القريبة منك.'
              : 'Explore events, exhibitions, and cultural or educational activities near you.'}
          </AppText>
          <SourceButton compact language={language} />
        </View>
      ) : null}

      {state.data?.cached ? (
        <Notice
          detail={
            language === 'ar'
              ? 'تعذر تحديث الفعاليات. يتم عرض آخر بيانات محفوظة.'
              : 'Events could not refresh. Showing the last saved data.'
          }
          tone="muted"
        />
      ) : null}

      {state.data?.isShowingFallbackEvents && events.length > 0 ? (
        <Notice
          detail={
            language === 'ar'
              ? 'نعرض لك الفعاليات القادمة في باقي المحافظات السورية.'
              : 'Showing upcoming events from other Syrian provinces instead.'
          }
          title={
            language === 'ar'
              ? `لا توجد فعاليات قادمة مسجلة حالياً في ${currentGovernorate}`
              : `No upcoming events are registered in ${currentGovernorate}`
          }
          tone="warning"
        />
      ) : null}

      {state.loading ? (
        <AppCard style={styles.centerState}>
          <ActivityIndicator color={theme.palette.primary} size="large" />
          <AppText color="muted" style={textStyle}>
            {language === 'ar' ? 'جاري تحميل الفعاليات...' : 'Loading events...'}
          </AppText>
        </AppCard>
      ) : state.error ? (
        <AppCard style={styles.centerState}>
          <AlertCircle color={theme.palette.danger} size={36} />
          <AppText color="danger" style={textStyle} variant="label">
            {language === 'ar'
              ? 'فشل تحميل الفعاليات حالياً'
              : 'Failed to load events'}
          </AppText>
          <AppButton
            icon={<RefreshCw color={theme.palette.foreground} size={17} />}
            onPress={state.retry}
            variant="secondary"
          >
            {language === 'ar' ? 'إعادة المحاولة' : 'Try Again'}
          </AppButton>
        </AppCard>
      ) : events.length === 0 ? (
        <AppCard style={styles.centerState}>
          <Calendar color={theme.palette.mutedForeground} size={36} />
          <AppText color="muted" style={textStyle}>
            {language === 'ar'
              ? 'لا توجد فعاليات قادمة مسجلة حالياً في هذه المحافظة.'
              : 'No upcoming events are registered for this province.'}
          </AppText>
        </AppCard>
      ) : variant === 'single' ? (
        <SingleEvent event={events[0]} language={language} />
      ) : (
        <View style={styles.grid}>
          {events.map((event) => (
            <EventCard event={event} key={event.id} language={language} />
          ))}
          <SourceButton language={language} />
        </View>
      )}

      {state.refreshing && state.data ? (
        <View style={[styles.refreshing, { flexDirection: rowDirection }]}>
          <ActivityIndicator color={theme.palette.primary} size="small" />
          <AppText color="muted" style={textStyle} variant="caption">
            {language === 'ar' ? 'تحديث الفعاليات...' : 'Refreshing events...'}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

function SingleEvent({
  event,
  language,
}: {
  event: F3aliaEvent | undefined;
  language: F3aliaLanguage;
}) {
  const { theme } = useAppTheme();
  if (!event) {
    return null;
  }
  const rtl = language === 'ar';
  return (
    <AppCard style={styles.singleCard}>
      <View
        style={[
          styles.singleCopy,
          { alignItems: rtl ? 'flex-end' : 'flex-start' },
        ]}
      >
        <View
          style={[
            styles.inline,
            { flexDirection: rtl ? 'row-reverse' : 'row' },
          ]}
        >
          <Sparkles color={theme.palette.primary} size={15} />
          <AppText
            color="primary"
            style={{ textAlign: rtl ? 'right' : 'left' }}
            variant="label"
          >
            {language === 'ar' ? 'الفعالية القادمة:' : 'Next Event:'}{' '}
            {event.name}
          </AppText>
        </View>
        <AppText color="muted" variant="caption">
          {provinceLabel(event, language)}
        </AppText>
        <AppText color="muted" variant="caption">
          {formatEventDate(event.eventDate, language)}
          {event.eventTime ? `  •  ${event.eventTime}` : ''}
        </AppText>
      </View>
      <AppButton
        icon={<ExternalLink color={theme.palette.primary} size={15} />}
        onPress={() => openExternal(eventDetailUrl(event))}
        variant="ghost"
      >
        {language === 'ar' ? 'التفاصيل' : 'Details'}
      </AppButton>
    </AppCard>
  );
}

function EventCard({
  event,
  language,
}: {
  event: F3aliaEvent;
  language: F3aliaLanguage;
}) {
  const { theme } = useAppTheme();
  const rtl = language === 'ar';
  const image = eventImageUrl(event);
  const rowDirection = rtl ? ('row-reverse' as const) : ('row' as const);
  const textStyle = { textAlign: rtl ? ('right' as const) : ('left' as const) };
  const location = event.isOnline
    ? language === 'ar'
      ? 'فعالية افتراضية (عبر الإنترنت)'
      : 'Online Event'
    : event.address;
  return (
    <AppCard style={styles.eventCard}>
      {image ? (
        <Image
          accessibilityLabel={event.name}
          contentFit="cover"
          source={{ uri: image }}
          style={styles.cover}
          transition={150}
        />
      ) : (
        <View
          style={[
            styles.coverFallback,
            { backgroundColor: eventFallbackColor(event.id) },
          ]}
        >
          <Sparkles color="rgba(255,255,255,0.65)" size={24} />
          <AppText style={styles.fallbackText} variant="heading">
            {event.category
              ? language === 'ar'
                ? event.category.nameAr
                : event.category.nameEn
              : language === 'ar'
                ? 'فعالية جديدة'
                : 'New Event'}
          </AppText>
        </View>
      )}

      <View style={[styles.badgeRow, { flexDirection: rowDirection }]}>
        {event.category ? (
          <Badge label={language === 'ar' ? event.category.nameAr : event.category.nameEn} />
        ) : null}
        <Badge
          label={
            event.isFree
              ? language === 'ar'
                ? 'مجاني'
                : 'Free'
              : `${event.ticketPrice.toLocaleString(language === 'ar' ? 'ar-SY' : 'en-US')} ${
                  language === 'ar' ? 'ل.س' : 'SYP'
                }`
          }
          success={event.isFree}
        />
      </View>

      <AppText style={textStyle} variant="heading">
        {event.name}
      </AppText>
      <EventFact
        icon={<Calendar color={theme.palette.primary} size={15} />}
        language={language}
        value={formatEventDate(event.eventDate, language)}
      />
      {event.eventTime ? (
        <EventFact
          icon={<Clock color={theme.palette.primary} size={15} />}
          language={language}
          value={event.eventTime}
        />
      ) : null}
      <EventFact
        icon={<MapPin color={theme.palette.primary} size={15} />}
        language={language}
        value={location}
      />
      <AppText color="muted" style={textStyle} variant="caption">
        {event.description}
      </AppText>

      <View style={[styles.footer, { flexDirection: rowDirection }]}>
        <AppText color="muted" style={textStyle} variant="caption">
          {event.owner?.organizerName ??
            (language === 'ar' ? 'منصة فعالية' : 'F3alia Platform')}
        </AppText>
        <AppButton
          icon={<ExternalLink color={theme.palette.primaryForeground} size={15} />}
          onPress={() => openExternal(eventDetailUrl(event))}
        >
          {language === 'ar' ? 'حجز / تفاصيل' : 'Details & Tickets'}
        </AppButton>
      </View>
    </AppCard>
  );
}

function EventFact({
  icon,
  language,
  value,
}: {
  icon: ReactNode;
  language: F3aliaLanguage;
  value: string;
}) {
  return (
    <View
      style={[
        styles.fact,
        { flexDirection: language === 'ar' ? 'row-reverse' : 'row' },
      ]}
    >
      {icon}
      <AppText
        color="muted"
        style={{ textAlign: language === 'ar' ? 'right' : 'left' }}
        variant="caption"
      >
        {value}
      </AppText>
    </View>
  );
}

function Badge({ label, success = false }: { label: string; success?: boolean }) {
  const { theme } = useAppTheme();
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: success
            ? `${theme.palette.success}22`
            : theme.palette.surfaceRaised,
          borderColor: success ? theme.palette.success : theme.palette.border,
        },
      ]}
    >
      <AppText color={success ? 'success' : 'primary'} variant="caption">
        {label}
      </AppText>
    </View>
  );
}

function Notice({
  detail,
  title,
  tone,
}: {
  detail: string;
  title?: string;
  tone: 'muted' | 'warning';
}) {
  const { theme } = useAppTheme();
  const color = tone === 'warning' ? '#d97706' : theme.palette.mutedForeground;
  return (
    <View
      style={[
        styles.notice,
        { backgroundColor: `${color}14`, borderColor: `${color}55` },
      ]}
    >
      <AlertCircle color={color} size={18} />
      <View style={styles.noticeCopy}>
        {title ? <AppText variant="label">{title}</AppText> : null}
        <AppText color="muted" variant="caption">
          {detail}
        </AppText>
      </View>
    </View>
  );
}

function SourceButton({
  compact = false,
  language,
}: {
  compact?: boolean;
  language: F3aliaLanguage;
}) {
  const { theme } = useAppTheme();
  const label = compact
    ? language === 'ar'
      ? 'المصدر: منصة فعالية (F3alia)'
      : 'Source: F3alia Platform'
    : language === 'ar'
      ? 'عرض المزيد من الفعاليات في المصدر (فعالية)'
      : 'View more events at source (F3alia)';
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => openExternal(F3ALIA_SOURCE)}
      style={({ pressed }) => [
        styles.source,
        {
          borderColor: theme.palette.primary,
          flexDirection: language === 'ar' ? 'row-reverse' : 'row',
          opacity: pressed ? 0.65 : 1,
        },
      ]}
    >
      <AppText color="primary" variant="caption">
        {label}
      </AppText>
      <ExternalLink color={theme.palette.primary} size={14} />
    </Pressable>
  );
}

function formatEventDate(value: string, language: F3aliaLanguage): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return value;
  }
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleDateString(language === 'ar' ? 'ar-SY' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function openExternal(url: string): void {
  void openSafeExternalUrl(url).catch(() => undefined);
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  badgeRow: {
    flexWrap: 'wrap',
    gap: 7,
  },
  centerState: {
    alignItems: 'center',
    gap: 12,
    justifyContent: 'center',
    minHeight: 180,
  },
  cover: {
    borderRadius: 13,
    height: 170,
    width: '100%',
  },
  coverFallback: {
    alignItems: 'center',
    borderRadius: 13,
    gap: 10,
    height: 170,
    justifyContent: 'center',
    padding: 20,
    width: '100%',
  },
  eventCard: {
    gap: 11,
    overflow: 'hidden',
    width: '100%',
  },
  fact: {
    alignItems: 'center',
    gap: 7,
  },
  fallbackText: {
    color: '#ffffff',
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    borderTopColor: 'rgba(127,127,127,0.25)',
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  grid: {
    gap: 14,
  },
  header: {
    gap: 7,
  },
  inline: {
    alignItems: 'center',
    gap: 6,
  },
  notice: {
    alignItems: 'flex-start',
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 10,
    padding: 12,
  },
  noticeCopy: {
    flex: 1,
    gap: 2,
  },
  refreshing: {
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  root: {
    gap: 14,
    width: '100%',
  },
  singleCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  singleCopy: {
    flex: 1,
    gap: 3,
  },
  source: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  titleRow: {
    alignItems: 'center',
    gap: 8,
  },
});

/*
PORT STATUS
  source:     resources/js/Components/F3aliaEvents.tsx (605 lines)
  confidence: high
  todos:      0
  notes:      Native GraphQL queries, cache fallback, bilingual variants, event cards, detail links, and source attribution are verified.
*/
