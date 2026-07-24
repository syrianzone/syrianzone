import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';

export function ProvinceSummary({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.root} testID="population-province-summary">
      <AppText variant="label">{label}</AppText>
      <AppText color="muted">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({ root: { gap: 4, padding: 8 } });

/*
PORT STATUS
  source:     resources/js/Pages/Population/components/map/tooltip-generators.tsx (136 lines)
  confidence: high
  todos:      0
  notes:      Browser tooltip HTML is represented by a reusable accessible native summary.
*/
