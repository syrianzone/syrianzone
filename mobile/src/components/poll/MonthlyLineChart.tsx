import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Image as SvgImage,
  Line,
  Path,
  Text as SvgText,
} from 'react-native-svg';

import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';
import { resolvePollImageUrl } from '@/features/Polls/sharing';

export interface MonthlyChartSeries {
  color?: string;
  imageUrl?: null | string;
  name: string;
  values: number[];
}

interface MonthlyLineChartProps {
  // Shared images must read the same for everyone, so a capture host pins light surface colors.
  forCapture?: boolean;
  height?: number;
  months: readonly string[];
  series: readonly MonthlyChartSeries[];
}

export const captureColors = {
  border: '#cbd5e1',
  foreground: '#18211a',
  mutedForeground: '#475569',
  surface: '#ffffff',
} as const;

function hashNumber(input: string): number {
  let hash = 0;
  for (const character of input) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  }
  return Math.abs(hash);
}

function hashToColor(input: string): string {
  return `hsl(${hashNumber(input) % 360}, 65%, 48%)`;
}

export default function MonthlyLineChart({
  forCapture = false,
  height = 260,
  months,
  series,
}: MonthlyLineChartProps) {
  const { theme } = useAppTheme();
  const palette = forCapture ? captureColors : theme.palette;
  const captureText = forCapture ? { color: captureColors.foreground } : null;
  const [width, setWidth] = useState(340);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const padding = { bottom: 38, left: 42, right: 14, top: 16 };
  const innerWidth = Math.max(10, width - padding.left - padding.right);
  const innerHeight = Math.max(10, height - padding.top - padding.bottom);
  const maxY = useMemo(
    () => Math.max(1, ...series.flatMap(({ values }) => values)),
    [series],
  );
  const ticks = Array.from({ length: 5 }, (_, index) =>
    Math.round((maxY * index) / 4),
  );
  const visibleSeries = selected.size > 0
    ? series.filter(({ name }) => selected.has(name))
    : series;
  const firstDataIndex = Math.min(
    ...series.map(({ values }) => {
      const index = values.findIndex((value) => value > 0);
      return index < 0 ? months.length : index;
    }),
    months.length,
  );
  const xFor = (index: number) => months.length <= 1
    ? padding.left + innerWidth / 2
    : padding.left + (index / (months.length - 1)) * innerWidth;
  const yFor = (value: number) =>
    padding.top + (1 - value / maxY) * innerHeight;
  const onLayout = (event: LayoutChangeEvent) => {
    setWidth(Math.max(260, event.nativeEvent.layout.width));
  };
  const labelStep = Math.max(1, Math.ceil(months.length / 6));

  return (
    <AppCard
      onLayout={onLayout}
      style={[
        styles.card,
        forCapture && {
          backgroundColor: captureColors.surface,
          borderColor: captureColors.border,
        },
      ]}
    >
      <AppText style={captureText} variant="label">تطوّر النقاط الشهري</AppText>
      <Svg accessibilityLabel="مخطط تطور النقاط" height={height} width={width}>
        <Line
          stroke={palette.border}
          x1={padding.left}
          x2={padding.left}
          y1={padding.top}
          y2={height - padding.bottom}
        />
        <Line
          stroke={palette.border}
          x1={padding.left}
          x2={width - padding.right}
          y1={height - padding.bottom}
          y2={height - padding.bottom}
        />
        {ticks.map((tick) => {
          const y = yFor(tick);
          return (
            <G key={tick}>
              <Line
                stroke={palette.border}
                strokeOpacity={0.45}
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
              />
              <SvgText
                fill={palette.mutedForeground}
                fontSize={10}
                textAnchor="end"
                x={padding.left - 6}
                y={y + 3}
              >
                {tick}
              </SvgText>
            </G>
          );
        })}
        {months.map((month, index) => index % labelStep === 0 ? (
          <SvgText
            fill={palette.mutedForeground}
            fontSize={9}
            key={month}
            textAnchor="middle"
            x={xFor(index)}
            y={height - 14}
          >
            {month}
          </SvgText>
        ) : null)}
        {[...visibleSeries].reverse().map((item) => {
          const color = item.color ?? hashToColor(item.name);
          const points = item.values.map((value, index) =>
            `${index === 0 ? 'M' : 'L'}${xFor(index)},${yFor(value || 0)}`,
          ).join(' ');
          const imageUrl = resolvePollImageUrl(item.imageUrl);
          return (
            <G key={item.name}>
              <Path d={points} fill="none" stroke={color} strokeWidth={2.5} />
              {item.values.map((value, index) => {
                const cx = xFor(index);
                const cy = yFor(value || 0);
                const clipId = `avatar-${hashNumber(item.name)}-${index}`;
                return imageUrl && index >= firstDataIndex ? (
                  <G key={clipId}>
                    <Defs>
                      <ClipPath id={clipId}>
                        <Circle cx={cx} cy={cy} r={8} />
                      </ClipPath>
                    </Defs>
                    <SvgImage
                      clipPath={`url(#${clipId})`}
                      height={16}
                      href={{ uri: imageUrl }}
                      preserveAspectRatio="xMidYMid slice"
                      width={16}
                      x={cx - 8}
                      y={cy - 8}
                    />
                    <Circle cx={cx} cy={cy} fill="none" r={8} stroke={color} />
                  </G>
                ) : (
                  <Circle cx={cx} cy={cy} fill={color} key={clipId} r={3} />
                );
              })}
            </G>
          );
        })}
      </Svg>
      <View style={styles.legend}>
        {series.map((item) => {
          const active = selected.size === 0 || selected.has(item.name);
          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
              key={item.name}
              onPress={() => setSelected((current) => {
                const next = new Set(current);
                if (next.has(item.name)) {
                  next.delete(item.name);
                } else {
                  next.add(item.name);
                }
                return next;
              })}
              style={[styles.legendItem, { opacity: active ? 1 : 0.45 }]}
            >
              <View
                style={[
                  styles.legendColor,
                  { backgroundColor: item.color ?? hashToColor(item.name) },
                ]}
              />
              <AppText style={captureText} variant="caption">{item.name}</AppText>
            </Pressable>
          );
        })}
      </View>
      {selected.size > 0 ? (
        <Pressable onPress={() => setSelected(new Set())}>
          <AppText color="primary" variant="caption">مسح التحديد</AppText>
        </Pressable>
      ) : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    overflow: 'hidden',
    paddingHorizontal: 4,
  },
  legend: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 10,
  },
  legendColor: {
    borderRadius: 2,
    height: 6,
    width: 22,
  },
  legendItem: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 6,
  },
});

/*
PORT STATUS
  source:     resources/js/Components/poll/MonthlyLineChart.tsx (198 lines)
  confidence: high
  todos:      0
  notes:      Responsive native SVG preserves axes, selection, deterministic colors, and avatar points; a capture host pins light colors so shared images match across themes.
*/
