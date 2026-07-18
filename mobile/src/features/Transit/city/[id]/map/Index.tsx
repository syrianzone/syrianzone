import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { QueryState } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';

import { GlobalSearchBox } from '../../../_components/citymap/GlobalSearchBox';
import { NearbyTransitDrawer } from '../../../_components/citymap/NearbyTransitDrawer';
import { OfflineBanner } from '../../../_components/citymap/OfflineBanner';
import { TransitMapView } from '../../../_components/citymap/MapView';
import cities from '../../../_data/cities';
import { transitFallback } from '../../../_data/fallback';
import { useMapData } from '../../../_hooks/useMapData';
import type { City } from '../../../_types';

export default function TransitCityMapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useMapData(id);
  const city = cities.find((item) => item.id === id) as City | undefined;
  const data = query.data ?? transitFallback(id);
  if (!city) {
    return <QueryState detail="المدينة غير معروفة." type="error" />;
  }
  return (
    <Screen contentStyle={styles.screen} scroll={false}>
      <OfflineBanner />
      <View style={styles.controls}>
        <GlobalSearchBox cityId={id} />
        <NearbyTransitDrawer />
      </View>
      {data ? (
        <View style={styles.map}>
          <TransitMapView city={city} data={data} />
        </View>
      ) : query.error ? (
        <QueryState onRetry={() => void query.refetch()} type="error" />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  controls: {
    gap: 8,
    padding: 12,
  },
  map: {
    flex: 1,
    minHeight: 360,
  },
  screen: {
    flex: 1,
    gap: 0,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Transit/city/[id]/map/Index.tsx (140 lines)
  confidence: high
  todos:      0
  notes:      Native MapLibre preserves live or offline geometry, search, nearby stops, and refresh.
*/
