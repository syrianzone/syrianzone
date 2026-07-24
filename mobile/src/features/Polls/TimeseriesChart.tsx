import { Share2 } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import MonthlyLineChart from '@/components/poll/MonthlyLineChart';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';
import {
  buildChartSeries,
  type ChartMetric,
  type ChartTimeframe,
  type ChartView,
} from '@/features/Polls/model';
import { shareCapturedPollImage } from '@/features/Polls/sharing';
import type { PollCandidate, PollHistory, PollRanking } from '@/lib/api/polls';

export interface TimeseriesChartProps {
  candidates: readonly PollRanking[];
  history: PollHistory;
  title: string;
}

const colors = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#d97706',
  '#9333ea',
  '#0891b2',
  '#be185d',
  '#4f46e5',
  '#ca8a04',
  '#059669',
] as const;

export function TimeseriesChart({
  candidates,
  history,
  title,
}: TimeseriesChartProps) {
  const { theme } = useAppTheme();
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('day');
  const [metric, setMetric] = useState<ChartMetric>('score');
  const [view, setView] = useState<ChartView>('cumulative');
  const [selected, setSelected] = useState<readonly string[]>(['all']);
  const [shareError, setShareError] = useState(false);
  const captureTarget = useRef<View>(null);
  const chartCandidates = useMemo<PollCandidate[]>(
    () => candidates.map((candidate) => ({
      archiveReason: candidate.archiveReason,
      category: candidate.category ?? '',
      groupId: candidate.groupId,
      id: candidate.candidateId,
      imageUrl: candidate.imageUrl,
      name: candidate.name,
      status: candidate.status,
      successorId: candidate.successorId,
      termEndedAt: candidate.termEndedAt,
      termStartedAt: candidate.termStartedAt,
      title: candidate.title,
    })),
    [candidates],
  );
  const displayed = selected.includes('all')
    ? chartCandidates.slice(0, 5)
    : chartCandidates.filter(({ id }) => selected.includes(id));
  const chart = buildChartSeries(history, displayed, { metric, timeframe, view });
  const series = chart.series.map((item) => {
    const fullIndex = chartCandidates.findIndex(({ id }) => id === item.candidateId);
    return {
      color: colors[(fullIndex < 0 ? 0 : fullIndex) % colors.length],
      imageUrl: chartCandidates.find(({ id }) => id === item.candidateId)?.imageUrl,
      name: item.name,
      values: item.points,
    };
  });
  const toggleCandidate = (candidateId: string) => {
    if (candidateId === 'all') {
      setSelected(['all']);
      return;
    }
    setSelected((current) => {
      const explicit = current.includes('all') ? [] : [...current];
      const next = explicit.includes(candidateId)
        ? explicit.filter((id) => id !== candidateId)
        : [...explicit, candidateId];
      return next.length > 0 ? next : ['all'];
    });
  };

  return (
    <AppCard style={styles.container}>
      <View ref={captureTarget} style={styles.capture}>
        <AppText variant="heading">{title}</AppText>
        <AppText color="muted" variant="caption">تقدم المرشحين عبر الزمن</AppText>
        <MonthlyLineChart months={chart.labels} series={series} />
      </View>
      <ControlRow
        onSelect={(value) => setView(value as ChartView)}
        options={[['cumulative', 'تراكمي'], ['periodic', 'دوري']]}
        selected={view}
      />
      <ControlRow
        onSelect={(value) => setMetric(value as ChartMetric)}
        options={[['score', 'النقاط'], ['votes', 'الأصوات']]}
        selected={metric}
      />
      <ControlRow
        onSelect={(value) => setTimeframe(value as ChartTimeframe)}
        options={[
          ['day', 'يومي'],
          ['week', 'أسبوعي'],
          ['month', 'شهري'],
          ['year', 'سنوي'],
        ]}
        selected={timeframe}
      />
      <AppText variant="label">اختر للعرض:</AppText>
      <View style={styles.candidateChips}>
        <FilterChip
          active={selected.includes('all')}
          label="الكل (أفضل 5)"
          onPress={() => toggleCandidate('all')}
        />
        {chartCandidates.map((candidate) => (
          <FilterChip
            active={selected.includes(candidate.id)}
            key={candidate.id}
            label={candidate.name}
            onPress={() => toggleCandidate(candidate.id)}
          />
        ))}
      </View>
      {shareError ? (
        <AppText color="danger">تعذر مشاركة صورة المخطط.</AppText>
      ) : null}
      <AppButton
        icon={<Share2 color={theme.palette.foreground} size={18} />}
        onPress={() => {
          setShareError(false);
          void shareCapturedPollImage(captureTarget).catch(() => setShareError(true));
        }}
        variant="secondary"
      >
        مشاركة صورة المخطط
      </AppButton>
    </AppCard>
  );
}

function ControlRow({
  onSelect,
  options,
  selected,
}: {
  onSelect: (value: string) => void;
  options: readonly (readonly [string, string])[];
  selected: string;
}) {
  return (
    <View style={styles.controls}>
      {options.map(([value, label]) => (
        <FilterChip
          active={selected === value}
          key={value}
          label={label}
          onPress={() => onSelect(value)}
        />
      ))}
    </View>
  );
}

function FilterChip({
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
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={[
        styles.chip,
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

const styles = StyleSheet.create({
  candidateChips: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 7,
  },
  capture: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    gap: 4,
    padding: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  container: {
    gap: 12,
  },
  controls: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 7,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Polls/TimeseriesChart.tsx (343 lines)
  confidence: high
  todos:      0
  notes:      Native SVG, touch filters, and the system share sheet replace Recharts and html2canvas.
*/
