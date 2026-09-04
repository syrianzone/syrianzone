import { Check, Languages, Palette, X } from 'lucide-react-native';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { useLocale } from '@/contexts/LocaleContext';
import { useAppTheme } from '@/contexts/ThemeContext';
import { THEME_REGISTRY, type ThemeConfig } from '@/lib/ported/theme';

// Same two sections as the website settings dialog: system sits with the
// standard themes, heritage themes get their own heading.
const groups = [
  {
    id: 'standard',
    nameAr: 'المظاهر الأساسية',
    nameEn: 'Standard',
    themes: THEME_REGISTRY.filter((theme) => theme.group !== 'heritage'),
  },
  {
    id: 'heritage',
    nameAr: 'التراث السوري',
    nameEn: 'Syrian Heritage',
    themes: THEME_REGISTRY.filter((theme) => theme.group === 'heritage'),
  },
] as const;

// Round swatch with the theme background, a primary ring and a primary bottom
// half, like the website. The system theme also paints its dark half.
function ThemeSwatch({ item }: { item: ThemeConfig }) {
  return (
    <View
      style={[
        styles.swatch,
        { backgroundColor: item.previewBackground, borderColor: item.primary },
      ]}
      testID={`theme-swatch-${item.id}`}
    >
      {item.previewBackgroundDark ? (
        <View
          style={[
            styles.swatchSplit,
            { backgroundColor: item.previewBackgroundDark },
          ]}
          testID={`theme-swatch-split-${item.id}`}
        />
      ) : null}
      <View
        style={[styles.swatchFill, { backgroundColor: item.primary }]}
        testID={`theme-swatch-fill-${item.id}`}
      />
    </View>
  );
}

export function ThemeToggle() {
  const [visible, setVisible] = useState(false);
  const { direction, locale, setLocale } = useLocale();
  const { preference, setPreference, theme } = useAppTheme();
  const rowDirection = direction === 'rtl' ? 'row-reverse' : 'row';

  return (
    <>
      <Pressable
        accessibilityLabel={
          locale === 'ar' ? 'تغيير المظهر واللغة' : 'Change theme and language'
        }
        accessibilityRole="button"
        hitSlop={10}
        onPress={() => setVisible(true)}
        style={({ pressed }) => [styles.trigger, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Palette color={theme.palette.foreground} size={22} />
      </Pressable>
      <Modal
        animationType="slide"
        onRequestClose={() => setVisible(false)}
        transparent
        visible={visible}
      >
        <View style={[styles.overlay, { backgroundColor: theme.palette.overlay }]}>
          <SafeAreaView
            edges={['bottom', 'left', 'right']}
            style={[
              styles.sheet,
              {
                backgroundColor: theme.palette.background,
                borderColor: theme.palette.border,
              },
            ]}
            testID="theme-sheet"
          >
            <View style={[styles.sheetHeader, { flexDirection: rowDirection }]}>
              <AppText variant="heading">
                {locale === 'ar' ? 'المظهر واللغة' : 'Theme and language'}
              </AppText>
              <Pressable
                accessibilityLabel={locale === 'ar' ? 'إغلاق' : 'Close'}
                accessibilityRole="button"
                onPress={() => setVisible(false)}
              >
                <X color={theme.palette.foreground} size={24} />
              </Pressable>
            </View>
            <View style={styles.languageRow}>
              <AppButton
                icon={<Languages color={theme.palette.foreground} size={18} />}
                onPress={() => void setLocale(locale === 'ar' ? 'en' : 'ar')}
                variant="secondary"
              >
                {locale === 'ar' ? 'English' : 'العربية'}
              </AppButton>
            </View>
            <ScrollView contentContainerStyle={styles.themeList}>
              {groups.map((group) => (
                <View key={group.id} style={styles.group} testID={`theme-group-${group.id}`}>
                  <AppText color="muted" variant="caption">
                    {locale === 'ar' ? group.nameAr : group.nameEn}
                  </AppText>
                  <View style={[styles.grid, { flexDirection: rowDirection }]}>
                    {group.themes.map((item) => {
                      const active = preference === item.id;
                      return (
                        <Pressable
                          accessibilityRole="radio"
                          accessibilityState={{ checked: active }}
                          key={item.id}
                          onPress={() => void setPreference(item.id)}
                          style={({ pressed }) => [
                            styles.themeRow,
                            {
                              // Website: primary at 10% alpha behind the active
                              // row, the muted surface behind the rest.
                              backgroundColor: active
                                ? `${item.primary}1a`
                                : theme.palette.surfaceRaised,
                              borderColor: active ? item.primary : 'transparent',
                              flexDirection: rowDirection,
                              opacity: pressed ? 0.7 : 1,
                            },
                          ]}
                        >
                          <ThemeSwatch item={item} />
                          <AppText
                            numberOfLines={1}
                            style={[styles.themeName, active && { color: item.primary }]}
                            variant="caption"
                          >
                            {item.emoji} {locale === 'ar' ? item.nameAr : item.nameEn}
                          </AppText>
                          {active ? <Check color={item.primary} size={16} /> : null}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  group: {
    gap: 8,
  },
  languageRow: {
    paddingHorizontal: 16,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    maxHeight: '82%',
    paddingBottom: 12,
  },
  sheetHeader: {
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  swatch: {
    borderRadius: 12,
    borderWidth: 2,
    height: 24,
    overflow: 'hidden',
    width: 24,
  },
  swatchFill: {
    bottom: 0,
    height: '50%',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  swatchSplit: {
    bottom: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    width: '50%',
  },
  themeList: {
    gap: 16,
    padding: 16,
  },
  themeName: {
    flex: 1,
  },
  themeRow: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 2,
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: '48%',
  },
  trigger: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
});

/*
PORT STATUS
  source:     resources/js/Components/ThemeToggle.tsx (97 lines) for the
              trigger, resources/js/Pages/Home.tsx settings dialog (theme
              section, lines 1043 to 1109) for the grouped grid and swatch
  confidence: high
  todos:      0
  notes:      A native modal replaces the browser dropdown and storage events.
              The website has no language button here; it stays because the
              app has no other settings surface.
*/
