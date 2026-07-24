import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Bus, Map, MapPin } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
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
      trailing={data ? (
        <AppButton
          accessibilityLabel={`فتح ${data.route.nameAr} على الخريطة`}
          icon={<Map color={theme.palette.primaryForeground} size={18} />}
          onPress={() =>
            router.push({
              pathname: '/transit/city/[id]/map',
              params: { id, route: data.route.id },
            })
          }
        >
          فتح الخريطة
        </AppButton>
      ) : undefined}
    >
      {data ? (
        <>
          <AppCard style={styles.summary}>
            <View style={styles.summaryHeading}>
              <View
                style={[
                  styles.routeColor,
                  { backgroundColor: routeColor(data.route.colorIndex) },
                ]}
              />
              <Bus color={theme.palette.primary} size={26} />
              <View style={styles.copy}>
                {data.route.nameEn ? (
                  <>
                    <AppText color="muted" variant="caption">تفاصيل الخط</AppText>
                    <AppText>{data.route.nameEn}</AppText>
                  </>
                ) : null}
              </View>
            </View>
            <View style={styles.stats}>
              <View style={styles.stat}>
                <AppText color="muted" variant="caption">سعر الركوب</AppText>
                <AppText color="primary" variant="heading">
                  {data.route.priceNew
                    ? `${data.route.priceNew.toLocaleString('ar-SY')} ل.س`
                    : 'غير متوفر'}
                </AppText>
              </View>
              <View style={styles.stat}>
                <AppText color="muted" variant="caption">عدد المواقف</AppText>
                <AppText variant="heading">
                  {data.stops.length.toLocaleString('ar-SY')} موقف
                </AppText>
              </View>
            </View>
            {data.route.priceOld && data.route.priceOld > 0 ? (
              <View
                style={[
                  styles.oldPrice,
                  { borderTopColor: theme.palette.border },
                ]}
              >
                <AppText color="muted" variant="caption">السعر بالليرة القديمة</AppText>
                <AppText color="muted" variant="caption">
                  {data.route.priceOld.toLocaleString('ar-SY')} ليرة سورية قديمة
                </AppText>
              </View>
            ) : null}
          </AppCard>
          <View style={styles.stopHeading}>
            <AppText variant="heading">المواقف على الخط</AppText>
            <AppText color="muted" variant="caption">
              {data.stops.length.toLocaleString('ar-SY')} موقف
            </AppText>
          </View>
          {data.stops.length ? (
            data.stops.map((stop, index) => (
              <AppCard key={stop.properties.id} style={styles.stop}>
                <View style={styles.order}>
                  <AppText style={styles.orderText} variant="label">
                    {index + 1}
                  </AppText>
                </View>
                <MapPin color={theme.palette.primary} size={20} />
                <View style={styles.copy}>
                  <AppText variant="label">{stop.properties.nameAr}</AppText>
                  {stop.properties.nameEn ? (
                    <AppText color="muted" variant="caption">
                      {stop.properties.nameEn}
                    </AppText>
                  ) : null}
                </View>
                <DirectionsButton
                  coordinate={stop.coordinates}
                  label={stop.properties.nameAr}
                />
              </AppCard>
            ))
          ) : (
            <AppText color="muted">لا توجد مواقف مسجلة لهذا الخط</AppText>
          )}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  copy: {
    flex: 1,
  },
  oldPrice: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 2,
    paddingTop: 10,
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
  stat: {
    flex: 1,
    gap: 2,
  },
  stats: {
    flexDirection: 'row',
    gap: 16,
  },
  stop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  stopHeading: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summary: {
    gap: 12,
  },
  summaryHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Transit/city/[id]/route/[routeId]/Index.tsx (226 lines)
  confidence: high
  todos:      0
  notes:      The native detail preserves fare history, bilingual stops, focused map entry, route color, and directions.
*/
