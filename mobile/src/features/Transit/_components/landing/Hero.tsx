import { Bus, MapPinned } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';

export function Hero() {
  const { theme } = useAppTheme();
  return (
    <View style={styles.hero}>
      <View style={styles.icons}>
        <Bus color={theme.palette.primary} size={38} />
        <MapPinned color={theme.palette.primary} size={28} />
      </View>
      <AppText style={styles.center} variant="title">ترانزيت سوريا</AppText>
      <AppText color="muted" style={styles.center}>
        خطوط النقل، المحطات، البحث، والاتجاهات في المدن السورية
      </AppText>
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
  icons: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Transit/_components/landing/Hero.tsx (55 lines)
  confidence: high
  todos:      0
  notes:      Native typography and icons preserve the landing introduction.
*/
