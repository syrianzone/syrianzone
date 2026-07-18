import * as Location from 'expo-location';
import { LocateFixed, Navigation } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';

import type { NearbyStop } from '../../_types';
import { getNearbyStops } from '../../api';

export function NearbyTransitDrawer() {
  const { theme } = useAppTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stops, setStops] = useState<NearbyStop[]>([]);
  const locate = async () => {
    setLoading(true);
    setError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setError('يلزم السماح بالموقع لعرض المحطات القريبة.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setStops(
        await getNearbyStops(
          position.coords.latitude,
          position.coords.longitude,
        ),
      );
    } catch {
      setError('تعذر جلب المحطات القريبة.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <View style={styles.root}>
      <AppButton
        icon={<LocateFixed color={theme.palette.primaryForeground} size={18} />}
        loading={loading}
        onPress={() => void locate()}
      >
        المحطات القريبة
      </AppButton>
      {error ? <AppText color="danger">{error}</AppText> : null}
      {stops.map((stop) => (
        <AppCard key={stop.id} style={styles.stop}>
          <Navigation color={theme.palette.primary} size={18} />
          <View style={styles.copy}>
            <AppText variant="label">{stop.nameAr}</AppText>
            <AppText color="muted" variant="caption">
              {stop.routes.map((route) => route.name_ar).join('، ') || 'دون خطوط منشورة'}
            </AppText>
          </View>
        </AppCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  copy: {
    flex: 1,
  },
  root: {
    gap: 8,
  },
  stop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Transit/_components/citymap/NearbyTransitDrawer.tsx (197 lines)
  confidence: high
  todos:      0
  notes:      Foreground permission and native location replace browser geolocation.
*/
