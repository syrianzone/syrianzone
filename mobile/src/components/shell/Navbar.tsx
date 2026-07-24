import { Image } from 'expo-image';
import { router, usePathname } from 'expo-router';
import { ArrowLeft, ArrowRight, Home, UserRound } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { useLocale } from '@/contexts/LocaleContext';
import { useAppTheme } from '@/contexts/ThemeContext';

import { ThemeToggle } from './ThemeToggle';

export function Navbar() {
  const pathname = usePathname();
  const { direction, locale } = useLocale();
  const { theme } = useAppTheme();
  const atHome = pathname === '/';
  const BackIcon = direction === 'rtl' ? ArrowRight : ArrowLeft;

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{ backgroundColor: theme.palette.surface }}
    >
      <View
        style={[
          styles.bar,
          {
            borderBottomColor: theme.palette.border,
            flexDirection: direction === 'rtl' ? 'row-reverse' : 'row',
          },
        ]}
      >
        <View
          style={[
            styles.leading,
            { flexDirection: direction === 'rtl' ? 'row-reverse' : 'row' },
          ]}
        >
          {!atHome ? (
            <Pressable
              accessibilityLabel={locale === 'ar' ? 'رجوع' : 'Back'}
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => router.back()}
              style={styles.iconButton}
            >
              <BackIcon color={theme.palette.foreground} size={22} />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityLabel={locale === 'ar' ? 'الرئيسية' : 'Home'}
            accessibilityRole="button"
            onPress={() => router.replace('/')}
            style={styles.brand}
          >
            <Image
              contentFit="contain"
              source={
                theme.isDark
                  ? require('../../../assets/images/logo-darkmode.svg')
                  : require('../../../assets/images/logo-lightmode.svg')
              }
              style={styles.logo}
            />
            <AppText numberOfLines={1} variant="label">
              {locale === 'ar' ? 'المساحة السورية' : 'Syrian Zone'}
            </AppText>
          </Pressable>
        </View>
        <View style={styles.actions}>
          {!atHome ? (
            <Pressable
              accessibilityLabel={locale === 'ar' ? 'الرئيسية' : 'Home'}
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => router.replace('/')}
              style={styles.iconButton}
            >
              <Home color={theme.palette.foreground} size={21} />
            </Pressable>
          ) : null}
          <ThemeToggle />
          <Pressable
            accessibilityLabel={locale === 'ar' ? 'الحساب' : 'Account'}
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => router.push('/account')}
            style={styles.iconButton}
          >
            <UserRound color={theme.palette.foreground} size={21} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  bar: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    height: 58,
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  brand: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  leading: {
    alignItems: 'center',
    flex: 1,
  },
  logo: {
    height: 34,
    width: 34,
  },
});

/*
PORT STATUS
  source:     resources/js/Components/Navbar.tsx (555 lines)
  confidence: high
  todos:      0
  notes:      Expo Router navigation replaces browser links and responsive menus.
*/
