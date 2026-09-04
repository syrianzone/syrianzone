import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowLeft, ArrowRight, Menu, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLocale } from '@/contexts/LocaleContext';
import { useAppTheme } from '@/contexts/ThemeContext';

import { Sidebar } from './Sidebar';
import { ThemeToggle } from './ThemeToggle';

export function Navbar() {
  const { direction, locale } = useLocale();
  const { theme } = useAppTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const BackIcon = direction === 'rtl' ? ArrowRight : ArrowLeft;
  const rowDirection = direction === 'rtl' ? 'row-reverse' : 'row';

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
            flexDirection: rowDirection,
          },
        ]}
      >
        {/* The logo sits in its own absolute layer so it stays centered no
            matter how many buttons each side carries. */}
        <View pointerEvents="box-none" style={styles.center}>
          <Pressable
            accessibilityLabel={locale === 'ar' ? 'الرئيسية' : 'Home'}
            accessibilityRole="button"
            onPress={() => router.replace('/')}
          >
            <Image
              contentFit="contain"
              source={
                theme.isDark
                  ? require('../../../assets/images/logo-darkmode.svg')
                  : require('../../../assets/images/logo-lightmode.svg')
              }
              style={styles.logo}
              testID="navbar-logo"
            />
          </Pressable>
        </View>

        <View style={[styles.side, { flexDirection: rowDirection }]}>
          <Pressable
            accessibilityLabel={locale === 'ar' ? 'القائمة' : 'Menu'}
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => setMenuOpen(true)}
            style={styles.iconButton}
            testID="navbar-menu"
          >
            <Menu color={theme.palette.foreground} size={24} />
          </Pressable>
          {router.canGoBack() ? (
            <Pressable
              accessibilityLabel={locale === 'ar' ? 'رجوع' : 'Back'}
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => router.back()}
              style={styles.iconButton}
              testID="navbar-back"
            >
              <BackIcon color={theme.palette.foreground} size={22} />
            </Pressable>
          ) : null}
        </View>

        <View style={[styles.side, styles.end, { flexDirection: rowDirection }]}>
          <ThemeToggle />
          <Pressable
            accessibilityLabel={locale === 'ar' ? 'الحساب' : 'Account'}
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => router.push('/account')}
            style={styles.iconButton}
            testID="navbar-account"
          >
            <UserRound color={theme.palette.foreground} size={21} />
          </Pressable>
        </View>
      </View>
      <Sidebar onClose={() => setMenuOpen(false)} visible={menuOpen} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    height: 64,
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  center: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  end: {
    justifyContent: 'flex-end',
  },
  iconButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  logo: {
    height: 36,
    width: 69,
  },
  side: {
    alignItems: 'center',
  },
});

/*
PORT STATUS
  source:     resources/js/Components/Navbar.tsx (555 lines)
  confidence: high
  todos:      0
  notes:      The phone layout of the website header: hamburger sheet at the
              start, image-only logo centered, theme and account at the end.
              The back button is native-only and appears once the stack can pop.
*/
