import { WifiOff } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';

import { useOffline } from '../../_hooks/useOffline';

export function OfflineBanner() {
  const offline = useOffline();
  const { theme } = useAppTheme();
  return offline ? (
    <View style={[styles.banner, { backgroundColor: theme.palette.surfaceRaised }]}>
      <WifiOff color={theme.palette.danger} size={17} />
      <AppText variant="caption">أنت دون اتصال، تعرض آخر بيانات محفوظة.</AppText>
    </View>
  ) : null;
}

const styles = StyleSheet.create({
  banner: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Transit/_components/citymap/OfflineBanner.tsx (20 lines)
  confidence: high
  todos:      0
  notes:      NetInfo drives the native cached-data banner.
*/
