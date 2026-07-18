import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';

import type { PopulationCollection, PopulationFeature } from '../../types';

export default function MapClient({
  data,
}: {
  data: PopulationCollection;
  onSelect: (feature: PopulationFeature) => void;
}) {
  return (
    <View style={styles.fallback}>
      <AppText color="muted">
        خريطة السكان التفاعلية متاحة في تطبيق أندرويد وiOS.
      </AppText>
      <AppText color="muted" variant="caption">
        تم تحميل {data.features.length.toLocaleString('ar-SY')} منطقة بنجاح.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    gap: 8,
    height: 420,
    justifyContent: 'center',
    padding: 24,
  },
});
