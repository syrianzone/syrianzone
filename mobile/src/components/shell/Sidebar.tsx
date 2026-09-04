import { Image } from 'expo-image';
import { router, usePathname } from 'expo-router';
import { ExternalLink, LogIn, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { quickLinkIcon } from '@/components/icons/ProjectIcons';
import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import UserNav from '@/components/UserNav';
import { useOptionalAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useAppTheme } from '@/contexts/ThemeContext';
import { featureRegistry } from '@/features/registry';
import { openSafeExternalUrl } from '@/lib/linking';

// The website sheet order (resources/js/Components/Navbar.tsx navLinks), minus
// the entries that have no native screen.
const navSlugs = [
  'syofficial',
  'roznama',
  'phonebook',
  'warnings',
  'syid',
  'tierlist',
  'contributors',
  'sites',
  'population',
  'party',
  'house',
  'compass',
  'priorities',
  'govapps',
  'transit',
  'shawarma',
  'justice',
  'places',
  'board',
] as const;

const navLinks = navSlugs.flatMap((slug) =>
  featureRegistry.filter((feature) => feature.slug === slug),
);

const externalLinks = [
  { id: 'news', labelAr: 'أخبار سوريا', labelEn: 'Syria news', url: 'https://news.jard.chat' },
  { id: 'answers', labelAr: 'إجابات سوريا', labelEn: 'Syria answers', url: 'https://answers.syrian.zone' },
  { id: 'joory', labelAr: 'جوري AI', labelEn: 'Joory AI', url: 'https://joory.chat' },
  { id: 'jard', labelAr: 'جرد', labelEn: 'Jard', url: 'https://jard.chat' },
  { id: 'recipes', labelAr: 'وصفاتنا', labelEn: 'Our recipes', url: 'https://food.syrian.zone' },
  {
    id: 'codex-community',
    labelAr: 'مجتمع كوديكس',
    labelEn: 'Codex community',
    url: 'https://discord.gg/NqE8849VzA',
  },
  {
    id: 'flag-replacer',
    labelAr: 'مبدل العلم',
    labelEn: 'Syrian flag replacer',
    url: 'https://chromewebstore.google.com/detail/syrian-flag-replacer/dngipobppehfhfggmbdiiiodgcibdeog',
  },
] as const;

const footerLinks = [
  { ar: 'عن المنصة', en: 'About', slug: 'about' },
  { ar: 'سياسة الخصوصية', en: 'Privacy policy', slug: 'privacy' },
  { ar: 'الشروط والأحكام', en: 'Terms', slug: 'terms' },
] as const;

/** Routes a registry slug the way the website links to its section. */
export function openFeature(slug: string): void {
  if (slug === 'board') {
    router.push('/board');
    return;
  }
  if (slug === 'transit') {
    router.push('/transit');
    return;
  }
  router.push({ pathname: '/feature/[slug]', params: { slug } });
}

/** The slug the current route belongs to, so the sheet can highlight it. */
function activeSlug(pathname: string): string {
  if (pathname.startsWith('/transit')) {
    return 'transit';
  }
  if (pathname.startsWith('/board')) {
    return 'board';
  }
  return pathname.startsWith('/feature/') ? pathname.slice('/feature/'.length) : '';
}

interface SidebarProps {
  onClose: () => void;
  visible: boolean;
}

export function Sidebar({ onClose, visible }: SidebarProps) {
  // useOptionalAuth keeps the sheet renderable outside the app provider tree;
  // without a session it shows the sign-in button the website shows.
  const auth = useOptionalAuth();
  const pathname = usePathname();
  const { direction, locale, t } = useLocale();
  const { theme } = useAppTheme();
  const { width } = useWindowDimensions();
  const panelWidth = Math.round(width * 0.82);
  // useState, not useRef: the value is read while rendering the panel transform.
  const [slide] = useState(() => new Animated.Value(0));
  const rowDirection = direction === 'rtl' ? 'row-reverse' : 'row';
  const current = activeSlug(pathname);

  useEffect(() => {
    Animated.timing(slide, {
      duration: 220,
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [slide, visible]);

  const navigate = (action: () => void) => {
    onClose();
    action();
  };

  return (
    <Modal
      animationType="none"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.fill}>
        <Pressable
          accessibilityLabel={locale === 'ar' ? 'إغلاق القائمة' : 'Close menu'}
          accessibilityRole="button"
          onPress={onClose}
          style={[styles.backdrop, { backgroundColor: theme.palette.overlay }]}
          testID="sidebar-backdrop"
        />
        <Animated.View
          style={[
            styles.panel,
            direction === 'rtl' ? styles.panelEnd : styles.panelStart,
            {
              backgroundColor: theme.palette.background,
              borderColor: theme.palette.border,
              transform: [
                {
                  translateX: slide.interpolate({
                    inputRange: [0, 1],
                    outputRange: [
                      direction === 'rtl' ? panelWidth : -panelWidth,
                      0,
                    ],
                  }),
                },
              ],
              width: panelWidth,
            },
          ]}
          testID="sidebar-panel"
        >
          <SafeAreaView edges={['bottom', 'top']} style={styles.fill}>
            <View style={[styles.header, { flexDirection: rowDirection }]}>
              <Pressable
                accessibilityLabel={locale === 'ar' ? 'الرئيسية' : 'Home'}
                accessibilityRole="button"
                onPress={() => navigate(() => router.replace('/'))}
              >
                <Image
                  contentFit="contain"
                  source={
                    theme.isDark
                      ? require('../../../assets/images/logo-darkmode.svg')
                      : require('../../../assets/images/logo-lightmode.svg')
                  }
                  style={styles.logo}
                  testID="sidebar-logo"
                />
              </Pressable>
              <Pressable
                accessibilityLabel={locale === 'ar' ? 'إغلاق' : 'Close'}
                accessibilityRole="button"
                hitSlop={10}
                onPress={onClose}
                testID="sidebar-close"
              >
                <X color={theme.palette.foreground} size={22} />
              </Pressable>
            </View>
            <Separator />

            <ScrollView contentContainerStyle={styles.list} style={styles.fill}>
              {navLinks.map((feature) => {
                const active = current === feature.slug;
                const Icon = feature.icon;
                const color = active
                  ? theme.palette.primary
                  : theme.palette.mutedForeground;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    key={feature.slug}
                    onPress={() => navigate(() => openFeature(feature.slug))}
                    style={({ pressed }) => [
                      styles.row,
                      { flexDirection: rowDirection, opacity: pressed ? 0.6 : 1 },
                    ]}
                    testID={`sidebar-link-${feature.slug}`}
                  >
                    <Icon color={color} size={18} />
                    <AppText style={{ color }} variant="label">
                      {locale === 'ar' ? feature.labelAr : feature.labelEn}
                    </AppText>
                  </Pressable>
                );
              })}

              <Separator />

              {externalLinks.map((link) => {
                const Icon = quickLinkIcon(link.id) ?? ExternalLink;
                return (
                  <Pressable
                    accessibilityRole="link"
                    key={link.id}
                    onPress={() =>
                      navigate(() => void openSafeExternalUrl(link.url))
                    }
                    style={({ pressed }) => [
                      styles.row,
                      { flexDirection: rowDirection, opacity: pressed ? 0.6 : 1 },
                    ]}
                    testID={`sidebar-external-${link.id}`}
                  >
                    <Icon color={theme.palette.mutedForeground} size={18} />
                    <AppText
                      style={[styles.rowLabel, { color: theme.palette.mutedForeground }]}
                      variant="label"
                    >
                      {locale === 'ar' ? link.labelAr : link.labelEn}
                    </AppText>
                    <ExternalLink color={theme.palette.mutedForeground} size={14} />
                  </Pressable>
                );
              })}

              <Separator />

              <View style={[styles.footer, { flexDirection: rowDirection }]}>
                {footerLinks.map((link) => (
                  <Pressable
                    accessibilityRole="button"
                    key={link.slug}
                    onPress={() =>
                      navigate(() =>
                        link.slug === 'about'
                          ? router.push('/about')
                          : openFeature(link.slug),
                      )
                    }
                    testID={`sidebar-footer-${link.slug}`}
                  >
                    <AppText color="muted" variant="caption">
                      {locale === 'ar' ? link.ar : link.en}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <View
              style={[styles.account, { borderTopColor: theme.palette.border }]}
            >
              {auth?.user ? (
                <UserNav
                  onOpenDashboard={() => navigate(() => openFeature('dashboard'))}
                  onOpenPolls={() => navigate(() => openFeature('polls'))}
                  onOpenProfile={() => navigate(() => router.push('/account'))}
                />
              ) : (
                <AppButton
                  icon={<LogIn color={theme.palette.foreground} size={18} />}
                  onPress={() => void auth?.login()}
                  testID="sidebar-sign-in"
                  variant="secondary"
                >
                  {t('signIn')}
                </AppButton>
              )}
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function Separator() {
  const { theme } = useAppTheme();
  return (
    <View
      style={[styles.separator, { backgroundColor: theme.palette.border }]}
    />
  );
}

const styles = StyleSheet.create({
  account: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  backdrop: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  fill: {
    flex: 1,
  },
  footer: {
    columnGap: 14,
    flexWrap: 'wrap',
    paddingVertical: 4,
    rowGap: 6,
  },
  header: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  list: {
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  logo: {
    height: 32,
    width: 61,
  },
  panel: {
    bottom: 0,
    position: 'absolute',
    top: 0,
  },
  panelEnd: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    right: 0,
  },
  panelStart: {
    borderRightWidth: StyleSheet.hairlineWidth,
    left: 0,
  },
  row: {
    alignItems: 'center',
    gap: 10,
    minHeight: 28,
  },
  rowLabel: {
    flex: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 20,
  },
});

/*
PORT STATUS
  source:     resources/js/Components/Navbar.tsx (Sheet branch, lines 142 to 303)
  confidence: high
  todos:      0
  notes:      A slide-in Modal replaces the Radix sheet. The website's transit-only
              link list is skipped because native Transit ships its own header.
              Section links come from the feature registry, so labels and icons
              stay in one place.
*/
