import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Bus, MapPin } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { QueryState } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { useAppTheme } from '@/contexts/ThemeContext';

import { DirectionsButton } from '../../../../_components/DirectionsButton';
import { routeColor } from '../../../../_lib/mapColors';
import { getRouteDetail } from '../../../../api';

export default function TransitRouteScreen() {
  const { id, routeId } = useLocalSearchParams<{
    id: string;
    routeId: string;
  }>();
  const { theme } = useAppTheme();
  const detail = useQuery({
    queryFn: () => getRouteDetail(id, routeId),
    queryKey: ['transit-route-detail', id, routeId],
  });
  if (detail.isError) {
    return (
      <QueryState
        detail="تعذر العثور على الخط."
        onRetry={() => void detail.refetch()}
        type="error"
      />
    );
  }
  const data = detail.data;
  return (
    <Screen
      subtitle={data?.city.nameAr}
      title={data?.route.nameAr ?? 'تفاصيل الخط'}
    >
      {data ? (
        <>
          <AppCard style={styles.summary}>
            <View
              style={[
                styles.routeColor,
                { backgroundColor: routeColor(data.route.colorIndex) },
              ]}
            />
            <Bus color={theme.palette.primary} size={26} />
            <View style={styles.copy}>
              {data.route.nameEn ? (
                <AppText color="muted">{data.route.nameEn}</AppText>
              ) : null}
              <AppText color="primary" variant="label">
                {data.route.priceNew
                  ? `${data.route.priceNew.toLocaleString('ar-SY')} ل.س`
                  : 'السعر غير متوفر'}
              </AppText>
            </View>
          </AppCard>
          <AppText variant="heading">المحطات بالترتيب</AppText>
          {data.stops.map((stop, index) => (
            <AppCard key={stop.properties.id} style={styles.stop}>
              <View style={styles.order}>
                <AppText style={styles.orderText} variant="label">{index + 1}</AppText>
              </View>
              <MapPin color={theme.palette.primary} size={20} />
              <View style={styles.copy}>
                <AppText variant="label">{stop.properties.nameAr}</AppText>
              </View>
              <DirectionsButton
                coordinate={stop.coordinates}
                label={stop.properties.nameAr}
              />
            </AppCard>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  copy: {
    flex: 1,
  },
  order: {
    alignItems: 'center',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  orderText: {
    textAlign: 'center',
  },
  routeColor: {
    borderRadius: 3,
    height: 48,
    width: 6,
  },
  stop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  summary: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Transit/city/[id]/route/[routeId]/Index.tsx (171 lines)
  confidence: high
  todos:      0
  notes:      The native detail preserves fares, ordered stops, route color, and directions.
*/
