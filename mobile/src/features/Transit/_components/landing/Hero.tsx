import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';

import type { City } from '../../_types';
import { transitSummary } from '../../model';

export function Hero({ cities }: { cities: readonly City[] }) {
  const summary = transitSummary(cities);
  return (
    <View style={styles.hero}>
      <AppText style={styles.center} variant="title">ترانزيت سوريا</AppText>
      <AppText color="muted" style={styles.center}>
        دليل وخرائط تفاعلية لشبكات وخطوط المواصلات العامة والسرافيس في المدن
        السورية، يجمعها المجتمع ويحدّثها، ومتاحة للجميع مجاناً.
      </AppText>
      <View style={styles.stats}>
        <View style={styles.stat}>
          <AppText variant="heading">
            {summary.readyCities.toLocaleString('ar-SY')}
          </AppText>
          <AppText color="muted" variant="caption">مدن جاهزة</AppText>
        </View>
        <View style={styles.stat}>
          <AppText variant="heading">
            {summary.totalRoutes.toLocaleString('ar-SY')}
          </AppText>
          <AppText color="muted" variant="caption">خط سيرفيس</AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    textAlign: 'center',
  },
  hero: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  stat: {
    alignItems: 'center',
    gap: 2,
  },
  stats: {
    flexDirection: 'row-reverse',
    gap: 28,
    justifyContent: 'center',
    paddingTop: 8,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Transit/_components/landing/Hero.tsx (38 lines)
  confidence: high
  todos:      0
  notes:      Native typography preserves the source introduction and live city and route totals.
*/
