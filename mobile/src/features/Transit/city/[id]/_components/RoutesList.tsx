import { router } from 'expo-router';
import { Bus, Map } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';

import { routeColor } from '../../../_lib/mapColors';
import type { RouteProperties } from '../../../_types';

export function RoutesList({
  cityId,
  routes,
}: {
  cityId: string;
  routes: readonly RouteProperties[];
}) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.root}>
      <AppButton
        icon={<Map color={theme.palette.primaryForeground} size={18} />}
        onPress={() =>
          router.push({ pathname: '/transit/city/[id]/map', params: { id: cityId } })
        }
      >
        عرض الخريطة الكاملة
      </AppButton>
      {routes.map((route) => (
        <Pressable
          key={route.id}
          onPress={() =>
            router.push({
              pathname: '/transit/city/[id]/route/[routeId]',
              params: { id: cityId, routeId: route.id },
            })
          }
        >
          <AppCard style={styles.route}>
            <View style={[styles.color, { backgroundColor: routeColor(route.colorIndex) }]} />
            <Bus color={theme.palette.primary} size={22} />
            <View style={styles.copy}>
              <AppText variant="label">{route.nameAr}</AppText>
              {route.nameEn ? (
                <AppText color="muted" variant="caption">{route.nameEn}</AppText>
              ) : null}
              {route.priceNew ? (
                <AppText color="primary" variant="caption">
                  {route.priceNew.toLocaleString('ar-SY')} ل.س
                </AppText>
              ) : null}
            </View>
          </AppCard>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  color: {
    borderRadius: 3,
    height: 44,
    width: 5,
  },
  copy: {
    flex: 1,
  },
  root: {
    gap: 10,
  },
  route: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Transit/city/[id]/_components/RoutesList.tsx (84 lines)
  confidence: high
  todos:      0
  notes:      Native cards preserve route colors, fares, map entry, and detail navigation.
*/
