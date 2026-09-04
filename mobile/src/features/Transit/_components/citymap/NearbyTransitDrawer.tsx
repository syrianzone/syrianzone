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

// The website asks the same endpoint for a 500 meter radius and names it in the
// empty state, so both stay tied to one constant.
const radiusMeters = 500;

type NearbyStatus = 'denied' | 'error' | 'idle' | 'loading' | 'locating' | 'ready';

const statusCopy: Readonly<Partial<Record<NearbyStatus, string>>> = {
  denied: 'يرجى السماح بالوصول إلى موقعك من إعدادات التطبيق',
  error: 'تعذر تحميل المواقف القريبة، حاول مجدداً',
  locating: 'جاري تحديد موقعك...',
};

export function NearbyTransitDrawer() {
  const { theme } = useAppTheme();
  const [status, setStatus] = useState<NearbyStatus>('idle');
  const [stops, setStops] = useState<NearbyStop[]>([]);
  const locate = async () => {
    setStatus('locating');
    setStops([]);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setStatus('denied');
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setStatus('loading');
      const nearby = await getNearbyStops(
        position.coords.latitude,
        position.coords.longitude,
        radiusMeters,
      );
      setStops(nearby);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  };
  const message = statusCopy[status];
  return (
    <View style={styles.root}>
      <AppButton
        icon={<LocateFixed color={theme.palette.primaryForeground} size={18} />}
        loading={status === 'loading' || status === 'locating'}
        onPress={() => void locate()}
      >
        المحطات القريبة
      </AppButton>
      {message ? (
        <AppText color={status === 'locating' ? 'muted' : 'danger'}>
          {message}
        </AppText>
      ) : null}
      {status === 'ready' && stops.length === 0 ? (
        <AppText color="muted">
          لا توجد مواقف في نطاق {radiusMeters} متر
        </AppText>
      ) : null}
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
  notes:      Foreground permission and native location replace browser geolocation, with the same 500 meter radius and locating, denied, error, and empty states.
*/
