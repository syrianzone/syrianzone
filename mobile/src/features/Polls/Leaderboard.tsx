import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Vote } from 'lucide-react-native';
import { useMemo, useState, type ComponentType } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { TierAvatar } from '@/components/poll/TierAvatar';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { QueryState } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { useAppTheme } from '@/contexts/ThemeContext';
import {
  formatCompactNumber,
  rankingGroupKey,
} from '@/features/Polls/model';
import {
  fetchPollLeaderboard,
  pollQueryKeys,
  type PollLeaderboard as PollLeaderboardData,
  type PollRanking,
  type PollStatus,
} from '@/lib/api/polls';

import {
  TimeseriesChart,
  type TimeseriesChartProps,
} from './TimeseriesChart';

export interface PollLeaderboardProps {
  ChartComponent?: ComponentType<TimeseriesChartProps>;
  identifier: string;
  onBack?: () => void;
  onVote?: () => void;
}

const statusOptions: readonly [PollStatus, string][] = [
  ['active', 'الحاليون'],
  ['former', 'السابقون'],
  ['all', 'الكل'],
];

export default function PollLeaderboard({
  ChartComponent = TimeseriesChart,
  identifier,
  onBack,
  onVote,
}: PollLeaderboardProps) {
  const { theme } = useAppTheme();
  const [status, setStatus] = useState<PollStatus>('active');
  const [groupKey, setGroupKey] = useState<string | null>(null);
  const query = useQuery<PollLeaderboardData>({
    placeholderData: (previous) => previous,
    queryFn: ({ signal }) => fetchPollLeaderboard(identifier, { signal, status }),
    queryKey: pollQueryKeys.leaderboard(identifier, status),
  });
  const groups = useMemo(() => query.data?.groups ?? [], [query.data?.groups]);
  const selectedGroupKey = groups.some(
    (group) => rankingGroupKey(group.key ?? group.id) === groupKey,
  )
    ? groupKey
    : groups[0]
      ? rankingGroupKey(groups[0].key ?? groups[0].id)
      : null;

  const successorIndex = useMemo(
    () => Object.fromEntries(
      Object.values(query.data?.rankings ?? {}).flat().map((row) => [
        row.candidateId,
        row.name,
      ]),
    ),
    [query.data?.rankings],
  );
  const rows = selectedGroupKey
    ? query.data?.rankings[selectedGroupKey] ?? []
    : [];
  const activeGroup = groups.find(
    (group) => rankingGroupKey(group.key ?? group.id) === selectedGroupKey,
  );

  return (
    <Screen
      onRefresh={() => void query.refetch()}
      refreshing={query.isFetching && !query.isPending}
      subtitle="نتائج مجتمع المساحة السورية"
      title={`إحصائيات ${query.data?.poll.title ?? 'الاستطلاع'}`}
      trailing={onBack ? (
        <AppButton
          accessibilityLabel="العودة"
          icon={<ArrowRight color={theme.palette.foreground} size={18} />}
          onPress={onBack}
          variant="ghost"
        >
          رجوع
        </AppButton>
      ) : null}
    >
      {onVote ? (
        <AppButton
          icon={<Vote color={theme.palette.foreground} size={18} />}
          onPress={onVote}
          variant="secondary"
        >
          صوّت الآن
        </AppButton>
      ) : null}
      <AppCard style={styles.notice}>
        <AppText variant="label">تنويه</AppText>
        <AppText color="muted">
          هذه منصة تصويت مجتمعية ذات طابع ساخر للترفيه والمناقشة. النتائج ليست استطلاعًا علميًا ولا تمثل رأيًا رسميًا.
        </AppText>
      </AppCard>
      {query.isPending ? (
        <View accessibilityLabel="جاري تحميل النتائج" style={styles.loading}>
          <ActivityIndicator color={theme.palette.primary} size="large" />
        </View>
      ) : null}
      {query.isError && !query.data ? (
        <QueryState
          detail="تعذر تحميل النتائج. تحقق من اتصالك وحاول مرة أخرى."
          onRetry={() => void query.refetch()}
          type="error"
        />
      ) : null}
      {query.data ? (
        <>
          {query.isError ? (
            <AppText color="muted">تعذر التحديث. يتم عرض آخر نتائج محفوظة.</AppText>
          ) : null}
          <View style={styles.filters}>
            {statusOptions.map(([value, label]) => (
              <FilterButton
                active={status === value}
                key={value}
                label={label}
                onPress={() => setStatus(value)}
              />
            ))}
          </View>
          <View accessibilityRole="tablist" style={styles.filters}>
            {groups.map((group) => {
              const key = rankingGroupKey(group.key ?? group.id);
              return (
                <FilterButton
                  active={selectedGroupKey === key}
                  key={group.id}
                  label={group.name}
                  onPress={() => setGroupKey(key)}
                />
              );
            })}
          </View>
          {rows.length === 0 ? (
            <QueryState detail="لا توجد نتائج لهذه الفئة بعد." type="empty" />
          ) : (
            <>
              <ChartComponent
                candidates={rows}
                history={query.data.history}
                title={`تقدم ${activeGroup?.name ?? 'المرشحين'}`}
              />
              <TopThree rows={rows.slice(0, 3)} title={activeGroup?.name ?? ''} />
              <AppCard style={styles.table}>
                <AppText variant="heading">قائمة التصنيف التفصيلية</AppText>
                {rows.map((row) => (
                  <RankingRow
                    key={row.candidateId}
                    row={row}
                    successorName={
                      row.successorId ? successorIndex[row.successorId] : undefined
                    }
                  />
                ))}
              </AppCard>
            </>
          )}
        </>
      ) : null}
    </Screen>
  );
}

function FilterButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  const { theme } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.filter,
        {
          backgroundColor: active ? theme.palette.primary : theme.palette.surface,
          borderColor: active ? theme.palette.primary : theme.palette.border,
        },
      ]}
    >
      <AppText
        style={{
          color: active
            ? theme.palette.primaryForeground
            : theme.palette.foreground,
        }}
        variant="caption"
      >
        {label}
      </AppText>
    </Pressable>
  );
}

function TopThree({ rows, title }: { rows: readonly PollRanking[]; title: string }) {
  if (rows.length < 3) {
    return null;
  }
  const display = [rows[1]!, rows[0]!, rows[2]!];
  return (
    <AppCard style={styles.podiumCard}>
      <AppText style={styles.center} variant="label">أفضل 3: {title}</AppText>
      <View style={styles.podium}>
        {display.map((row) => (
          <View key={row.candidateId} style={styles.podiumItem}>
            <TierAvatar imageUrl={row.imageUrl} name={row.name} size={row.rank === 1 ? 64 : 50} />
            <AppText style={styles.center} variant="label">#{row.rank} {row.name}</AppText>
            <AppText color="muted" style={styles.center} variant="caption">
              {formatCompactNumber(row.score)} نقطة
            </AppText>
          </View>
        ))}
      </View>
    </AppCard>
  );
}

function RankingRow({
  row,
  successorName,
}: {
  row: PollRanking;
  successorName?: string;
}) {
  return (
    <View style={[styles.rankingRow, row.status === 'archived' && styles.former]}>
      <AppText variant="heading">#{row.rank}</AppText>
      <TierAvatar imageUrl={row.imageUrl} name={row.name} size={38} />
      <View style={styles.rankingCopy}>
        <AppText variant="label">{row.name}</AppText>
        {row.title ? <AppText color="muted" variant="caption">{row.title}</AppText> : null}
        {row.status === 'archived' ? (
          <AppText color="muted" variant="caption">
            سابق{row.termEndedAt ? ` حتى ${row.termEndedAt}` : ''}
            {row.archiveReason ? `، ${row.archiveReason}` : ''}
            {successorName ? `، خلفه ${successorName}` : ''}
          </AppText>
        ) : null}
      </View>
      <View style={styles.numbers}>
        <AppText variant="label">{formatCompactNumber(row.score)}</AppText>
        <AppText color="muted" variant="caption">
          {formatCompactNumber(row.votes)} صوت، {row.avg.toFixed(2)} معدل
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    textAlign: 'center',
  },
  filter: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filters: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 7,
    justifyContent: 'center',
  },
  former: {
    opacity: 0.7,
  },
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
  },
  notice: {
    gap: 5,
  },
  numbers: {
    alignItems: 'flex-end',
  },
  podium: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-around',
  },
  podiumCard: {
    gap: 14,
  },
  podiumItem: {
    alignItems: 'center',
    flex: 1,
    gap: 5,
  },
  rankingCopy: {
    flex: 1,
  },
  rankingRow: {
    alignItems: 'center',
    borderBottomColor: '#d8dfd6',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row-reverse',
    gap: 9,
    paddingVertical: 10,
  },
  table: {
    gap: 4,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Polls/Leaderboard.tsx (348 lines)
  confidence: high
  todos:      0
  notes:      Dynamic native tabs, cached refresh, charts, podium, and former-office metadata preserve the results flow.
*/
