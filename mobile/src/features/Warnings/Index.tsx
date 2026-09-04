/**
 * Emergency warnings screen. One list, newest first, each card carrying the
 * feed's own color as a pill so a second warning feed would stand apart
 * without a code change. The screen never blocks on the stale flag: a stale
 * payload is still the best information the reader has during an outage,
 * so it renders with a notice instead of an error.
 */
import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { QueryState } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { useLocale } from '@/contexts/LocaleContext';
import { useAppTheme } from '@/contexts/ThemeContext';
import { openSafeExternalUrl } from '@/lib/linking';

import { fetchWarnings, JARD_WARNINGS_URL, warningsQueryKey } from './api';
import { formatRelativeTime, type WarningItem } from './model';

export const WARNINGS_STALE_TIME_MS = 5 * 60 * 1000;

const copy = {
  ar: {
    empty: 'لا توجد تنبيهات حالياً.',
    error: 'تعذر تحميل التنبيهات. تحقق من اتصالك وحاول مرة أخرى.',
    footer: 'عرض كل التنبيهات على جرد',
    open: 'فتح التنبيه',
    stale: 'تعذر تحديث التنبيهات. يتم عرض آخر نسخة محفوظة.',
    subtitle: 'وزارة الطوارئ وإدارة الكوارث عبر جرد',
    title: 'تنبيهات الطوارئ',
  },
  en: {
    empty: 'No warnings right now.',
    error: 'Could not load warnings. Check your connection and try again.',
    footer: 'See all warnings on jard',
    open: 'Open warning',
    stale: 'Warnings could not be refreshed. Showing the last saved copy.',
    subtitle: 'Ministry of Emergency and Disaster Management via jard',
    title: 'Emergency warnings',
  },
} as const;

export function pillColors(color: string, fallback: string) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
  return { background: `${safe}22`, foreground: safe };
}

export default function WarningsScreen() {
  const { locale } = useLocale();
  const text = copy[locale];
  const query = useQuery({
    queryFn: ({ signal }) => fetchWarnings(signal),
    queryKey: warningsQueryKey,
    staleTime: WARNINGS_STALE_TIME_MS,
  });
  // Relative times are measured from the fetch, which keeps render pure and
  // matches what the user saw when the list arrived; pull to refresh renews it.
  const now = query.dataUpdatedAt;
  const items = query.data?.items ?? [];

  let body;
  if (query.isPending) {
    body = <ActivityIndicator style={styles.loader} />;
  } else if (query.isError && !query.data) {
    body = (
      <QueryState
        detail={text.error}
        onRetry={() => void query.refetch()}
        type="error"
      />
    );
  } else if (items.length === 0) {
    body = <QueryState detail={text.empty} type="empty" />;
  } else {
    body = items.map((item) => (
      <WarningCard
        item={item}
        key={item.id}
        now={now}
        openLabel={text.open}
      />
    ));
  }

  return (
    <Screen
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching}
      subtitle={text.subtitle}
      title={text.title}
    >
      {query.data?.stale ? (
        <AppCard testID="warnings-stale-notice">
          <AppText color="muted">{text.stale}</AppText>
        </AppCard>
      ) : null}
      {body}
      <AppButton
        icon={<ExternalLink size={18} />}
        onPress={() => void openSafeExternalUrl(JARD_WARNINGS_URL)}
        variant="ghost"
      >
        {text.footer}
      </AppButton>
    </Screen>
  );
}

function WarningCard({
  item,
  now,
  openLabel,
}: {
  item: WarningItem;
  now: number;
  openLabel: string;
}) {
  const { locale } = useLocale();
  const { theme } = useAppTheme();
  const pill = pillColors(item.source.color, theme.palette.danger);

  return (
    <AppCard style={styles.card} testID={`warning-${item.id}`}>
      <View style={styles.meta}>
        <View
          style={[styles.pill, { backgroundColor: pill.background }]}
          testID={`warning-${item.id}-source`}
        >
          <AppText
            numberOfLines={1}
            style={{ color: pill.foreground }}
            variant="caption"
          >
            {item.source.name}
          </AppText>
        </View>
        <AppText color="muted" variant="caption">
          {formatRelativeTime(item.published_at, locale, now)}
        </AppText>
      </View>
      <AppText variant="label">{item.title}</AppText>
      {item.description ? <AppText>{item.description}</AppText> : null}
      <AppButton
        icon={<ExternalLink color={theme.palette.foreground} size={16} />}
        onPress={() => void openSafeExternalUrl(item.link)}
        variant="secondary"
      >
        {openLabel}
      </AppButton>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
  },
  loader: {
    marginVertical: 40,
  },
  meta: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  pill: {
    borderRadius: 999,
    flexShrink: 1,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
});

/*
PORT STATUS
  source:     none (new native feature)
  confidence: high
  todos:      0
  notes:      Newest-first list with feed-colored source pill, relative time, stale notice, refresh, and jard footer link.
*/
