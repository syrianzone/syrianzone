import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';

export default function CityLoading() {
  const { theme } = useAppTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={theme.palette.primary} size="large" />
      <AppText color="muted">جار تحميل خطوط النقل</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    flex: 1,
    gap: 10,
    justifyContent: 'center',
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Transit/city/[id]/loading.tsx (33 lines)
  confidence: high
  todos:      0
  notes:      A native activity state replaces the browser skeleton.
*/
