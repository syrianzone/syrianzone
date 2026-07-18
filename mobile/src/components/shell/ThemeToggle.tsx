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
import { THEME_REGISTRY } from '@/lib/ported/theme';

export function ThemeToggle() {
  const [visible, setVisible] = useState(false);
  const { direction, locale, setLocale } = useLocale();
  const { preference, setPreference, theme } = useAppTheme();

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
          >
            <View
              style={[
                styles.sheetHeader,
                { flexDirection: direction === 'rtl' ? 'row-reverse' : 'row' },
              ]}
            >
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
              {THEME_REGISTRY.map((item) => {
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
                        backgroundColor: active
                          ? theme.palette.surfaceRaised
                          : theme.palette.surface,
                        borderColor: active
                          ? theme.palette.primary
                          : theme.palette.border,
                        flexDirection:
                          direction === 'rtl' ? 'row-reverse' : 'row',
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.swatch,
                        { backgroundColor: item.previewBackground },
                      ]}
                    />
                    <AppText style={styles.themeName} variant="label">
                      {item.emoji} {locale === 'ar' ? item.nameAr : item.nameEn}
                    </AppText>
                    {active ? (
                      <Check color={theme.palette.primary} size={20} />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
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
    borderRadius: 14,
    height: 28,
    width: 28,
  },
  themeList: {
    gap: 8,
    padding: 16,
  },
  themeName: {
    flex: 1,
  },
  themeRow: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 10,
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
  source:     resources/js/Components/ThemeToggle.tsx (97 lines)
  confidence: high
  todos:      0
  notes:      A native modal replaces the browser dropdown and storage events.
*/
