import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  G,
  Rect,
  Text as SvgText,
} from 'react-native-svg';

import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';

import type { HouseStats, SexFilter } from './model';

const MALE_COLOR = '#556A4E';
const FEMALE_COLOR = '#A73F46';
const AGE_LABELS = ['<30', '30-39', '40-49', '50-59', '60+'] as const;

interface HouseChartsProps {
  sexFilter: SexFilter;
  stats: HouseStats;
}

function SexChart({ stats }: Pick<HouseChartsProps, 'stats'>) {
  const { theme } = useAppTheme();
  const size = 176;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = stats.male + stats.female;
  const maleLength = total > 0 ? (stats.male / total) * circumference : 0;
  const femaleLength = total > 0 ? (stats.female / total) * circumference : 0;

  return (
    <AppCard style={styles.chartCard} testID="house-sex-chart">
      <AppText variant="label">توزيع الجنس</AppText>
      <Svg
        accessibilityLabel={`ذكور ${stats.male}، إناث ${stats.female}`}
        height={size}
        width={size}
      >
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            fill="none"
            r={radius}
            stroke={theme.palette.surfaceRaised}
            strokeWidth={strokeWidth}
          />
          {maleLength > 0 ? (
            <Circle
              cx={size / 2}
              cy={size / 2}
              fill="none"
              r={radius}
              stroke={MALE_COLOR}
              strokeDasharray={[maleLength, circumference - maleLength]}
              strokeLinecap="butt"
              strokeWidth={strokeWidth}
            />
          ) : null}
          {femaleLength > 0 ? (
            <Circle
              cx={size / 2}
              cy={size / 2}
              fill="none"
              r={radius}
              stroke={FEMALE_COLOR}
              strokeDasharray={[femaleLength, circumference - femaleLength]}
              strokeDashoffset={-maleLength}
              strokeLinecap="butt"
              strokeWidth={strokeWidth}
            />
          ) : null}
        </G>
      </Svg>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: MALE_COLOR }]} />
          <AppText color="muted" variant="caption">
            ذكر {stats.male}
          </AppText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: FEMALE_COLOR }]} />
          <AppText color="muted" variant="caption">
            أنثى {stats.female}
          </AppText>
        </View>
      </View>
    </AppCard>
  );
}

function AgeChart({ sexFilter, stats }: HouseChartsProps) {
  const { theme } = useAppTheme();
  const values = [
    stats.ageGroups.lt30,
    stats.ageGroups['30s'],
    stats.ageGroups['40s'],
    stats.ageGroups['50s'],
    stats.ageGroups['60p'],
  ];
  const width = 320;
  const height = 190;
  const baseline = 154;
  const chartHeight = 118;
  const max = Math.max(1, ...values);
  const color = sexFilter === 'أنثى' ? FEMALE_COLOR : MALE_COLOR;

  return (
    <AppCard style={styles.chartCard} testID="house-age-chart">
      <AppText variant="label">توزيع الأعمار</AppText>
      <Svg
        accessibilityLabel={`توزيع الأعمار: ${values.join('، ')}`}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
      >
        <Rect
          fill={theme.palette.border}
          height={1}
          width={280}
          x={20}
          y={baseline}
        />
        {values.map((value, index) => {
          const barHeight = (value / max) * chartHeight;
          const x = 30 + index * 57;
          return (
            <G key={AGE_LABELS[index]}>
              <Rect
                fill={color}
                height={barHeight}
                rx={4}
                width={34}
                x={x}
                y={baseline - barHeight}
              />
              <SvgText
                fill={theme.palette.foreground}
                fontFamily="IBMPlexSansArabic_600SemiBold"
                fontSize={12}
                textAnchor="middle"
                x={x + 17}
                y={Math.max(16, baseline - barHeight - 7)}
              >
                {value}
              </SvgText>
              <SvgText
                fill={theme.palette.mutedForeground}
                fontFamily="IBMPlexSansArabic_400Regular"
                fontSize={10}
                textAnchor="middle"
                x={x + 17}
                y={176}
              >
                {AGE_LABELS[index]}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    </AppCard>
  );
}

export function HouseCharts({ sexFilter, stats }: HouseChartsProps) {
  return (
    <View style={styles.charts}>
      <SexChart stats={stats} />
      <AgeChart sexFilter={sexFilter} stats={stats} />
    </View>
  );
}

const styles = StyleSheet.create({
  chartCard: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    minWidth: 280,
  },
  charts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  legendItem: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 6,
  },
  legendRow: {
    flexDirection: 'row-reverse',
    gap: 18,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/House/HouseClient.tsx (533 lines)
  confidence: high
  todos:      0
  notes:      SVG doughnut and bar charts retain source colors, labels, values, and accessibility text.
*/
