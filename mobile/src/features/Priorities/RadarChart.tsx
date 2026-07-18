import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Line,
  Polygon,
  Text as SvgText,
} from 'react-native-svg';

import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';

import type { Comparison, Topic } from './data';
import { radarPoints } from './model';

const labels: Readonly<Record<string, string>> = {
  digital: 'الرقمنة',
  economy: 'الاقتصاد',
  housing: 'السكن',
  justice: 'العدالة',
  politics: 'السياسة',
  security: 'الأمن',
};

interface RadarChartProps {
  comparison?: Comparison;
  gridColor?: string;
  labelColor?: string;
  primaryColor?: string;
  size?: number;
  topics: readonly Topic[];
}

function pointList(points: readonly { x: number; y: number }[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(' ');
}

export function RadarChart({
  comparison,
  gridColor,
  labelColor,
  primaryColor,
  size = 280,
  topics,
}: RadarChartProps) {
  const { theme } = useAppTheme();
  const boundedSize = Math.max(180, Math.min(360, size));
  const center = boundedSize / 2;
  const radius = boundedSize * 0.31;
  const userValues = topics.map((topic) => topic.points);
  const comparisonValues = topics.map(
    (topic) => comparison?.points[topic.id] ?? 0,
  );
  const maximum = Math.max(45, ...userValues, ...comparisonValues);
  const axes = radarPoints(
    topics.map(() => maximum),
    center,
    radius,
    maximum,
  );
  const user = radarPoints(userValues, center, radius, maximum);
  const reference = radarPoints(
    comparisonValues,
    center,
    radius,
    maximum,
  );
  const primary = primaryColor ?? theme.palette.primary;
  const grid = gridColor ?? theme.palette.border;
  const text = labelColor ?? theme.palette.mutedForeground;

  return (
    <View
      accessibilityLabel="مخطط راداري لمقارنة توزيع الأولويات"
      accessible
      style={styles.root}
    >
      <Svg height={boundedSize} width={boundedSize}>
        {[0.25, 0.5, 0.75, 1].map((scale) => (
          <Polygon
            fill="none"
            key={scale}
            points={pointList(
              radarPoints(
                topics.map(() => maximum * scale),
                center,
                radius,
                maximum,
              ),
            )}
            stroke={grid}
            strokeOpacity={0.7}
            strokeWidth={1}
          />
        ))}
        {axes.map((point, index) => (
          <Line
            key={topics[index]?.id}
            stroke={grid}
            strokeOpacity={0.7}
            strokeWidth={1}
            x1={center}
            x2={point.x}
            y1={center}
            y2={point.y}
          />
        ))}
        {comparison ? (
          <Polygon
            fill="rgba(148, 163, 184, 0.08)"
            points={pointList(reference)}
            stroke="#94a3b8"
            strokeDasharray="5 4"
            strokeWidth={2}
          />
        ) : null}
        <Polygon
          fill={primary}
          fillOpacity={0.18}
          points={pointList(user)}
          stroke={primary}
          strokeWidth={3}
        />
        {user.map((point, index) => (
          <Circle
            cx={point.x}
            cy={point.y}
            fill={primary}
            key={`point-${topics[index]?.id}`}
            r={4}
            stroke="#ffffff"
            strokeWidth={1.5}
          />
        ))}
        {axes.map((point, index) => {
          const topic = topics[index];
          if (!topic) {
            return null;
          }
          const x = center + (point.x - center) * 1.32;
          const y = center + (point.y - center) * 1.32 + 4;
          return (
            <SvgText
              fill={text}
              fontFamily="IBMPlexSansArabic_600SemiBold"
              fontSize={boundedSize < 220 ? 9 : 11}
              key={`label-${topic.id}`}
              textAnchor="middle"
              x={x}
              y={y}
            >
              {labels[topic.id] ?? topic.name}
            </SvgText>
          );
        })}
      </Svg>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: primary }]} />
          <AppText style={{ color: text }} variant="caption">توزيعك</AppText>
        </View>
        {comparison ? (
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: '#94a3b8' }]} />
            <AppText style={{ color: text }} variant="caption">{comparison.title}</AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  legendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  root: {
    alignItems: 'center',
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Priorities/PrioritiesApp.tsx (1596 lines)
  confidence: high
  todos:      0
  notes:      Native SVG preserves the live radar profile and selected comparison.
*/
