import { Pressable, StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';
import { openSafeExternalUrl } from '@/lib/linking';

import type { DataSource } from '../types';
import {
  governorateEntries,
  type GovernorateComparison,
} from '../model';

function ComparisonBar({
  color,
  ratio,
}: {
  color: string;
  ratio: number;
}) {
  const width = `${Math.max(ratio * 100, 2)}%` as `${number}%`;
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { backgroundColor: color, width }]} />
    </View>
  );
}

export function GovernorateComparisonCard({
  comparison,
  onClear,
}: {
  comparison: GovernorateComparison;
  onClear: () => void;
}) {
  const { theme } = useAppTheme();
  return (
    <AppCard testID="population-comparison">
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <AppText variant="heading">مقارنة المحافظات</AppText>
          <AppText color="muted">
            {comparison.first.name} مقابل {comparison.second.name}
          </AppText>
        </View>
        <Pressable accessibilityRole="button" onPress={onClear}>
          <AppText color="primary" variant="label">مسح</AppText>
        </Pressable>
      </View>
      <View style={styles.rows}>
        {comparison.rows.map((row) => (
          <View key={row.type} style={styles.comparisonRow} testID={`population-comparison-${row.type}`}>
            <AppText variant="label">{row.label}</AppText>
            <View style={styles.valueRow}>
              <AppText>{row.first.toLocaleString('en-US')}</AppText>
              <AppText>{row.second.toLocaleString('en-US')}</AppText>
            </View>
            <ComparisonBar color={theme.palette.primary} ratio={row.first / row.max} />
            <ComparisonBar color={theme.palette.mutedForeground} ratio={row.second / row.max} />
          </View>
        ))}
      </View>
    </AppCard>
  );
}

export function DemographicPanel({
  compared,
  comparison,
  currentSourceId,
  onClearComparison,
  onSourceChange,
  onToggleProvince,
  source,
  sources,
}: {
  compared: readonly string[];
  comparison: GovernorateComparison | null;
  currentSourceId: number | null;
  onClearComparison: () => void;
  onSourceChange: (sourceId: number) => void;
  onToggleProvince: (province: string) => void;
  source: DataSource | null;
  sources: readonly DataSource[];
}) {
  const { theme } = useAppTheme();
  const governorates = governorateEntries(source);

  return (
    <View style={styles.cards}>
      {comparison ? (
        <GovernorateComparisonCard
          comparison={comparison}
          onClear={onClearComparison}
        />
      ) : null}
      <AppCard>
        <AppText variant="label">مصدر البيانات</AppText>
        {sources.length > 1 ? (
          <View style={styles.sourceTabs}>
            {sources.map((item) => {
              const active = currentSourceId === item.source_id;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  key={item.source_id}
                  onPress={() => onSourceChange(item.source_id)}
                  style={[
                    styles.sourceTab,
                    {
                      backgroundColor: active
                        ? theme.palette.primary
                        : theme.palette.surfaceRaised,
                      borderColor: theme.palette.border,
                    },
                  ]}
                  testID={`population-source-${item.source_id}`}
                >
                  <AppText
                    style={{
                      color: active
                        ? theme.palette.primaryForeground
                        : theme.palette.foreground,
                    }}
                    variant="caption"
                  >
                    {item.note ?? `المصدر ${item.source_id}`}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {source ? (
          <View style={styles.sourceDetails}>
            <AppText>{source.note ?? 'بيانات الأطلس'}</AppText>
            {source.date ? <AppText color="muted">{source.date}</AppText> : null}
            {source.source_url ? (
              <Pressable
                accessibilityRole="link"
                onPress={() => void openSafeExternalUrl(source.source_url ?? '')}
              >
                <AppText color="primary">فتح المصدر</AppText>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <AppText color="muted">لا تتوفر بيانات لهذا التصنيف.</AppText>
        )}
      </AppCard>

      {source ? (
        <AppCard>
          <View style={styles.headingRow}>
            <View style={styles.headingCopy}>
              <AppText variant="label">قائمة المحافظات</AppText>
              <AppText color="muted" variant="caption">
                اختر محافظتين للمقارنة بينهما، تم اختيار {compared.length}/2.
              </AppText>
            </View>
          </View>
          <View style={styles.governorates}>
            {governorates.map(([name, value], index) => {
              const active = compared.includes(name);
              return (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  key={name}
                  onPress={() => onToggleProvince(name)}
                  style={[
                    styles.governorate,
                    {
                      backgroundColor: active
                        ? theme.palette.surfaceRaised
                        : theme.palette.surface,
                      borderColor: active
                        ? theme.palette.primary
                        : theme.palette.border,
                    },
                  ]}
                  testID={`population-compare-${index}`}
                >
                  <AppText color={active ? 'primary' : 'muted'}>
                    {active ? '✓' : '○'}
                  </AppText>
                  <AppText style={styles.governorateName}>{name}</AppText>
                  <AppText color="muted">{value.toLocaleString('en-US')}</AppText>
                </Pressable>
              );
            })}
          </View>
        </AppCard>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  barFill: { borderRadius: 999, height: 6 },
  barTrack: { backgroundColor: 'rgba(148, 163, 184, 0.2)', borderRadius: 999, height: 6, overflow: 'hidden' },
  cards: { gap: 12 },
  comparisonRow: { gap: 6 },
  governorate: { alignItems: 'center', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 10, padding: 10 },
  governorateName: { flex: 1 },
  governorates: { gap: 8, marginTop: 12 },
  headingCopy: { flex: 1 },
  headingRow: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  rows: { gap: 16, marginTop: 12 },
  sourceDetails: { gap: 4, marginTop: 10 },
  sourceTab: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  sourceTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  valueRow: { flexDirection: 'row', justifyContent: 'space-between' },
});

/*
PORT STATUS
  source:     resources/js/Pages/Population/PopulationClient.tsx (996 lines)
  confidence: high
  todos:      0
  notes:      Native source controls and the two-governorate comparison preserve all demographic layers.
*/
