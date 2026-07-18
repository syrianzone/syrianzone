import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';

import type { ProvinceCollection } from './model';
import { selectProvince } from './model';

interface SyriaMapProps {
  geoJsonData: ProvinceCollection;
  selectedGovId?: string;
}

export default function SyriaMap({
  geoJsonData,
  selectedGovId = 'full',
}: SyriaMapProps) {
  const selected = selectProvince(geoJsonData, selectedGovId);
  return (
    <View style={styles.fallback}>
      <AppText color="muted">
        خريطة الحدود التفاعلية متاحة في تطبيق أندرويد وiOS.
      </AppText>
      <AppText color="muted" variant="caption">
        {selected.features.length > 0
          ? 'تم تحميل حدود المنطقة المحددة.'
          : 'تعذر العثور على حدود المحافظة.'}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    backgroundColor: '#24292F',
    flex: 1,
    gap: 8,
    justifyContent: 'center',
    minHeight: 360,
    padding: 24,
  },
});
