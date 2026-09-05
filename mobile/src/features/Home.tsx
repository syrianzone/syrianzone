import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
  CalendarDays,
  CloudSun,
  ExternalLink,
  Globe,
  Pencil,
  Plus,
  Search,
  Settings,
  UserRound,
  X,
} from 'lucide-react-native';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import F3aliaEvents from '@/components/F3aliaEvents';
import { quickLinkIcon } from '@/components/icons/ProjectIcons';
import { openFeature } from '@/components/shell/Sidebar';
import { ThemeToggle } from '@/components/shell/ThemeToggle';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { Screen } from '@/components/ui/Screen';
import UserNav from '@/components/UserNav';
import { useOptionalAuth } from '@/contexts/AuthContext';
import { useHomeSettings } from '@/contexts/HomeSettingsContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useAppTheme } from '@/contexts/ThemeContext';
import { featureRegistry } from '@/features/registry';
import { LatestWarningBanner } from '@/features/Warnings/Banner';
import { fetchPrayerTimes, fetchWeather } from '@/lib/home/widgets';
import { openSafeExternalUrl } from '@/lib/linking';
import {
  buildSearchUrl,
  buildSearchUrlFromTemplate,
  customLinkSchema,
  formatDuration,
  formatHijriDate,
  getNextPrayer,
  governorates,
  resolveHomeCoordinates,
  weatherTranslations,
  type CustomLink,
} from '@/lib/ported/home';

import {
  fetchHomeContent,
  type HomeQuickLink,
} from './Home/api';

const sourceFeatureSlugs = [
  'syofficial',
  'roznama',
  'phonebook',
  'syid',
  'party',
  'tierlist',
  'house',
  'compass',
  'priorities',
  'sites',
  'population',
  'govapps',
  'transit',
  'justice',
] as const;

// Reachable from the footer or the account screen, so the tools grid skips them.
const skipFromTools = new Set(['dashboard', 'privacy', 'terms']);

const fallbackExternalLinks: readonly HomeQuickLink[] = [
  {
    id: 'joory',
    label_ar: 'جوري AI',
    label_en: 'Joory AI',
    target: 'https://joory.chat',
    type: 'external',
  },
  {
    id: 'jard',
    label_ar: 'جرد',
    label_en: 'Jard',
    target: 'https://jard.chat',
    type: 'external',
  },
  {
    id: 'recipes',
    label_ar: 'وصفاتنا',
    label_en: 'Our recipes',
    target: 'https://food.syrian.zone',
    type: 'external',
  },
  {
    id: 'news',
    label_ar: 'أخبار سوريا',
    label_en: 'Syria news',
    target: 'https://news.jard.chat',
    type: 'external',
  },
  {
    id: 'answers',
    label_ar: 'إجابات سوريا',
    label_en: 'Syria answers',
    target: 'https://answers.syrian.zone',
    type: 'external',
  },
  {
    id: 'codex-community',
    label_ar: 'مجتمع كوديكس',
    label_en: 'Codex community',
    target: 'https://discord.gg/NqE8849VzA',
    type: 'external',
  },
  {
    id: 'flag-replacer',
    label_ar: 'مبدل العلم',
    label_en: 'Syrian flag replacer',
    target:
      'https://chromewebstore.google.com/detail/syrian-flag-replacer/dngipobppehfhfggmbdiiiodgcibdeog',
    type: 'external',
  },
];

function fallbackQuickLinks(): HomeQuickLink[] {
  const internal = sourceFeatureSlugs.flatMap((slug) => {
    const feature = featureRegistry.find((item) => item.slug === slug);
    return feature
      ? [
          {
            id: slug,
            label_ar: feature.labelAr,
            label_en: feature.labelEn,
            target: slug,
            type: 'feature' as const,
          },
        ]
      : [];
  });
  return [...internal, ...fallbackExternalLinks];
}

// The website asks Google's favicon service; the app asks the saved site itself
// (PORTING.md: never send browsing domains to a third party) and falls back to a
// globe when the site has no favicon.
function faviconUrl(url: string): string | null {
  try {
    return `${new URL(url).origin}/favicon.ico`;
  } catch {
    return null;
  }
}

function SiteFavicon({ url }: { url: string }) {
  const { theme } = useAppTheme();
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <Globe color={theme.palette.primary} size={28} />;
  }
  return (
    <View style={[styles.favicon, { borderColor: theme.palette.border }]}>
      <Image
        contentFit="contain"
        onError={() => setFailed(true)}
        source={{ uri: url }}
        style={styles.faviconImage}
      />
    </View>
  );
}

const defaultNow = () => new Date();

export interface HomeProps {
  liveClock?: boolean;
  now?: () => Date;
}

export default function Home({ liveClock = true, now = defaultNow }: HomeProps) {
  const auth = useOptionalAuth();
  const { hydrated, settings, updateSettings } = useHomeSettings();
  const { direction, locale } = useLocale();
  const { theme } = useAppTheme();
  const [currentTime, setCurrentTime] = useState(now);
  const [search, setSearch] = useState('');
  const [editLinks, setEditLinks] = useState(false);
  const [linkSheetOpen, setLinkSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customIcon, setCustomIcon] = useState('🔗');
  const [customLinkError, setCustomLinkError] = useState<string | null>(null);
  const coordinates = resolveHomeCoordinates(settings);
  const governorate =
    governorates.find((item) => item.id === settings.governorate) ??
    governorates[0];
  const rowDirection = direction === 'rtl' ? 'row-reverse' : 'row';
  // Stacked card content hugs the reading edge, so RTL cards start on the right.
  const columnAlign = direction === 'rtl' ? 'flex-end' : 'flex-start';

  useEffect(() => {
    if (!liveClock) {
      return;
    }
    const timer = setInterval(() => setCurrentTime(now()), 1000);
    return () => clearInterval(timer);
  }, [liveClock, now]);

  const homeContent = useQuery({
    queryKey: ['home-content'],
    queryFn: ({ signal }) => fetchHomeContent(signal),
    staleTime: 24 * 60 * 60 * 1000,
  });
  const weather = useQuery({
    enabled: hydrated && settings.showWeather,
    queryKey: [
      'home-weather',
      coordinates.latitude,
      coordinates.longitude,
    ],
    queryFn: ({ signal }) =>
      fetchWeather(coordinates.latitude, coordinates.longitude, signal),
    staleTime: 15 * 60 * 1000,
  });
  const prayers = useQuery({
    enabled: hydrated && settings.showPrayerTimes,
    queryKey: [
      'home-prayers',
      coordinates.latitude,
      coordinates.longitude,
      currentTime.getFullYear(),
      currentTime.getMonth(),
      currentTime.getDate(),
    ],
    queryFn: ({ signal }) =>
      fetchPrayerTimes(
        coordinates.latitude,
        coordinates.longitude,
        currentTime,
        signal,
      ),
    staleTime: 60 * 60 * 1000,
  });
  const nextPrayer = useMemo(
    () => (prayers.data ? getNextPrayer(prayers.data, currentTime) : null),
    [currentTime, prayers.data],
  );
  const quickLinks = homeContent.data?.quick_links ?? fallbackQuickLinks();
  const quickFeatureTargets = new Set(
    quickLinks
      .filter((link) => link.type === 'feature')
      .map((link) => link.target),
  );
  const additionalFeatures = featureRegistry.filter(
    (feature) =>
      !quickFeatureTargets.has(feature.slug) && !skipFromTools.has(feature.slug),
  );
  const hijriDate = formatHijriDate(currentTime, locale);

  const runSearch = async () => {
    const provider = homeContent.data?.search_providers.find(
      (item) => item.id === settings.searchEngine,
    );
    const url =
      settings.searchEngine === 'custom'
        ? buildSearchUrl('custom', search, settings.customSearchUrl)
        : buildSearchUrlFromTemplate(provider?.template, search) ??
          buildSearchUrl(settings.searchEngine, search);
    if (url && (await openSafeExternalUrl(url))) {
      setSearch('');
    }
  };

  const openQuickLink = async (link: HomeQuickLink) => {
    if (link.type === 'external') {
      await openSafeExternalUrl(link.target);
      return;
    }
    openFeature(link.target);
  };

  const openLinkSheet = (link: CustomLink | null) => {
    setEditingId(link?.id ?? null);
    setCustomIcon(link?.icon ?? '🔗');
    setCustomName(link?.name ?? '');
    setCustomUrl(link?.url ?? '');
    setCustomLinkError(null);
    setLinkSheetOpen(true);
  };

  const saveCustomLink = async () => {
    if (editingId === null && settings.customLinks.length >= 24) {
      setCustomLinkError(
        locale === 'ar'
          ? 'وصلت إلى الحد الأقصى: 24 رابطاً.'
          : 'You have reached the limit of 24 personal links.',
      );
      return;
    }
    const parsed = customLinkSchema.safeParse({
      icon: customIcon.trim() || '🔗',
      id:
        editingId ??
        `link-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name: customName,
      url: customUrl,
    });
    if (!parsed.success) {
      setCustomLinkError(
        locale === 'ar'
          ? 'أدخل اسماً ورابطاً صحيحاً يبدأ بـ https:// أو http://.'
          : 'Enter a name and a valid http:// or https:// URL.',
      );
      return;
    }
    await updateSettings({
      customLinks:
        editingId === null
          ? [...settings.customLinks, parsed.data]
          : settings.customLinks.map((link) =>
              link.id === editingId ? parsed.data : link,
            ),
    });
    setLinkSheetOpen(false);
    setCustomLinkError(null);
  };

  const removeCustomLink = async (id: string) => {
    await updateSettings({
      customLinks: settings.customLinks.filter((link) => link.id !== id),
    });
  };

  return (
    <View style={[styles.page, { backgroundColor: theme.palette.background }]}>
      {/* Same bar geometry as the navbar (64px, 44px buttons, 8px inset) so the
          icons sit where they do on every other screen; the start page has no
          navbar, so it owns the top safe area itself. */}
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={{ backgroundColor: theme.palette.background }}
        testID="home-top-bar"
      >
      <View
        style={[styles.topRow, { flexDirection: rowDirection }]}
        testID="home-controls"
      >
        <Pressable
          accessibilityLabel={locale === 'ar' ? 'الإعدادات' : 'Settings'}
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => router.push('/settings')}
          style={styles.iconButton}
          testID="home-settings"
        >
          <Settings color={theme.palette.foreground} size={22} />
        </Pressable>
        <View style={[styles.topActions, { flexDirection: rowDirection }]}>
          <ThemeToggle />
          {auth?.user ? (
            <UserNav
              onOpenDashboard={() => openFeature('dashboard')}
              onOpenPolls={() => openFeature('polls')}
              onOpenProfile={() => router.push('/account')}
            />
          ) : (
            <Pressable
              accessibilityLabel={locale === 'ar' ? 'الحساب' : 'Account'}
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => router.push('/account')}
              style={styles.iconButton}
              testID="home-account"
            >
              <UserRound color={theme.palette.foreground} size={22} />
            </Pressable>
          )}
        </View>
      </View>
      </SafeAreaView>
    <Screen>
      <View style={styles.logoRow}>
        <Image
          contentFit="contain"
          source={
            theme.isDark
              ? require('../../assets/images/logo-darkmode.svg')
              : require('../../assets/images/logo-lightmode.svg')
          }
          style={styles.logo}
          testID="home-logo"
        />
      </View>

      {settings.showClock ? (
        <AppCard style={styles.clockCard}>
          <AppText style={styles.clockTime} variant="title">
            {currentTime.toLocaleTimeString(
              locale === 'ar' ? 'ar-SY' : 'en-GB',
              {
                hour: '2-digit',
                hour12: settings.clockFormat === '12',
                minute: '2-digit',
                second: '2-digit',
              },
            )}
          </AppText>
          <AppText color="muted" style={styles.centered} variant="caption">
            {currentTime.toLocaleDateString(locale === 'ar' ? 'ar-SY' : 'en-GB', {
              day: 'numeric',
              month: 'long',
              weekday: 'long',
              year: 'numeric',
            })}
          </AppText>
          {hijriDate ? (
            <AppText
              color="primary"
              style={styles.centered}
              testID="home-hijri-date"
              variant="caption"
            >
              {hijriDate}
            </AppText>
          ) : null}
        </AppCard>
      ) : null}

      {settings.showWeather || settings.showPrayerTimes ? (
        <View style={[styles.widgets, { flexDirection: rowDirection }]}>
          {settings.showWeather ? (
            <AppCard style={[styles.widgetCard, { alignItems: columnAlign }]}>
              <CloudSun color={theme.palette.primary} size={25} />
              <AppText variant="heading">
                {weather.data
                  ? `${weather.data.temperature}°C`
                  : weather.isError
                    ? locale === 'ar'
                      ? 'غير متاح'
                      : 'Unavailable'
                    : '...'}
              </AppText>
              <AppText color="muted" variant="caption">
                {weather.data
                  ? locale === 'ar'
                    ? weatherTranslations[weather.data.description] ??
                      weather.data.description
                    : weather.data.description
                  : locale === 'ar'
                    ? governorate.ar
                    : governorate.en}
              </AppText>
            </AppCard>
          ) : null}

          {settings.showPrayerTimes ? (
            <AppCard style={[styles.widgetCard, { alignItems: columnAlign }]}>
              <CalendarDays color={theme.palette.primary} size={25} />
              <AppText variant="heading">
                {nextPrayer
                  ? locale === 'ar'
                    ? nextPrayer.labelAr
                    : nextPrayer.labelEn
                  : prayers.isError
                    ? locale === 'ar'
                      ? 'غير متاح'
                      : 'Unavailable'
                    : '...'}
              </AppText>
              <AppText color="muted" variant="caption">
                {nextPrayer
                  ? `${nextPrayer.time}  ${formatDuration(nextPrayer.remainingMs)}`
                  : locale === 'ar'
                    ? 'موعد الصلاة القادمة'
                    : 'Next prayer'}
              </AppText>
            </AppCard>
          ) : null}
        </View>
      ) : null}

      <LatestWarningBanner />

      {settings.useCustomCoordinates && settings.customCoordinates ? (
        <AppText color="muted" variant="caption">
          {locale === 'ar'
            ? `الطقس والصلاة حسب إحداثياتك ${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)}`
            : `Weather and prayer use ${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)}`}
        </AppText>
      ) : null}

      {settings.showSearch ? (
        <AppCard style={styles.searchCard}>
          <View style={[styles.searchRow, { flexDirection: rowDirection }]}>
            <AppInput
              accessibilityLabel={locale === 'ar' ? 'بحث في الويب' : 'Search the web'}
              onChangeText={setSearch}
              onSubmitEditing={() => void runSearch()}
              placeholder={locale === 'ar' ? 'ابحث في الويب' : 'Search the web'}
              returnKeyType="search"
              style={styles.searchInput}
              value={search}
            />
            <AppButton
              icon={<Search color={theme.palette.primaryForeground} size={18} />}
              onPress={() => void runSearch()}
            >
              {locale === 'ar' ? 'بحث' : 'Search'}
            </AppButton>
          </View>
          <View style={[styles.providerRow, { flexDirection: rowDirection }]}>
            {(homeContent.data?.search_providers ?? []).map((provider) => (
              <ProviderChoice
                active={settings.searchEngine === provider.id}
                key={provider.id}
                label={provider.label}
                onPress={() => void updateSettings({ searchEngine: provider.id })}
              />
            ))}
            <ProviderChoice
              active={settings.searchEngine === 'custom'}
              label={locale === 'ar' ? 'مخصص' : 'Custom'}
              onPress={() => void updateSettings({ searchEngine: 'custom' })}
            />
          </View>
        </AppCard>
      ) : null}

      {settings.showEvents ? (
        <F3aliaEvents
          enabled={hydrated}
          governorate={governorate.id}
          language={locale}
          variant="single"
        />
      ) : null}

      <AppText variant="heading">
        {locale === 'ar' ? 'روابط سريعة' : 'Quick links'}
      </AppText>
      {homeContent.isError ? (
        <AppText color="muted" variant="caption">
          {locale === 'ar'
            ? 'تعذر تحديث الروابط. يتم عرض النسخة المحفوظة في التطبيق.'
            : 'Quick links could not refresh. The built-in list is shown.'}
        </AppText>
      ) : null}
      <View style={[styles.grid, { flexDirection: rowDirection }]}>
        {quickLinks.map((link) => {
          const feature =
            link.type === 'feature'
              ? featureRegistry.find((item) => item.slug === link.target)
              : null;
          const Icon =
            feature?.icon ?? quickLinkIcon(link.id) ?? ExternalLink;
          return (
            <GridCard
              icon={<Icon color={theme.palette.primary} size={28} />}
              key={link.id}
              label={locale === 'ar' ? link.label_ar : link.label_en}
              onPress={() => void openQuickLink(link)}
            />
          );
        })}
      </View>

      {additionalFeatures.length > 0 ? (
        <>
          <AppText variant="heading">
            {locale === 'ar' ? 'أدوات إضافية' : 'More tools'}
          </AppText>
          <View style={[styles.grid, { flexDirection: rowDirection }]}>
            {additionalFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <GridCard
                  icon={<Icon color={theme.palette.primary} size={28} />}
                  key={feature.slug}
                  label={locale === 'ar' ? feature.labelAr : feature.labelEn}
                  onPress={() => openFeature(feature.slug)}
                />
              );
            })}
          </View>
        </>
      ) : null}

      <View style={[styles.sectionHeader, { flexDirection: rowDirection }]}>
        <AppText variant="heading">
          {locale === 'ar' ? 'روابط مخصصة' : 'Custom links'}
        </AppText>
        <View style={[styles.sectionActions, { flexDirection: rowDirection }]}>
          <SmallButton
            active={editLinks}
            icon={
              <Pencil
                color={
                  editLinks
                    ? theme.palette.primaryForeground
                    : theme.palette.foreground
                }
                size={15}
              />
            }
            label={
              locale === 'ar'
                ? editLinks
                  ? 'تم'
                  : 'تعديل'
                : editLinks
                  ? 'Done'
                  : 'Edit'
            }
            onPress={() => setEditLinks((value) => !value)}
            testID="home-toggle-edit-links"
          />
          <SmallButton
            icon={<Plus color={theme.palette.foreground} size={15} />}
            label={locale === 'ar' ? 'إضافة' : 'Add'}
            onPress={() => openLinkSheet(null)}
            testID="home-open-add-link"
          />
        </View>
      </View>

      {settings.customLinks.length > 0 ? (
        <View style={[styles.grid, { flexDirection: rowDirection }]}>
          {settings.customLinks.map((link) => {
            const favicon = link.icon === '🔗' ? faviconUrl(link.url) : null;
            return (
              <GridCard
                badge={
                  editLinks ? (
                    <Pressable
                      accessibilityLabel={
                        locale === 'ar' ? `حذف ${link.name}` : `Remove ${link.name}`
                      }
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => void removeCustomLink(link.id)}
                      style={[
                        styles.removeBadge,
                        direction === 'rtl' ? styles.badgeStart : styles.badgeEnd,
                        { backgroundColor: theme.palette.danger },
                      ]}
                      testID={`home-remove-custom-link-${link.id}`}
                    >
                      <X color={theme.palette.primaryForeground} size={14} />
                    </Pressable>
                  ) : null
                }
                icon={
                  favicon ? (
                    <SiteFavicon url={favicon} />
                  ) : link.icon === '🔗' ? (
                    <Globe color={theme.palette.primary} size={28} />
                  ) : (
                    <AppText style={styles.emoji}>{link.icon}</AppText>
                  )
                }
                key={link.id}
                label={link.name}
                onPress={() =>
                  editLinks
                    ? openLinkSheet(link)
                    : void openSafeExternalUrl(link.url)
                }
              />
            );
          })}
        </View>
      ) : (
        <AppCard
          style={[styles.emptyLinks, { borderColor: theme.palette.border }]}
        >
          <AppText color="muted" variant="caption">
            {locale === 'ar' ? 'لا توجد روابط مخصصة' : 'No custom links yet'}
          </AppText>
          <AppButton
            icon={<Plus color={theme.palette.foreground} size={18} />}
            onPress={() => openLinkSheet(null)}
            testID="home-add-first-link"
            variant="secondary"
          >
            {locale === 'ar' ? 'إضافة رابط' : 'Add link'}
          </AppButton>
        </AppCard>
      )}

      <View style={[styles.footer, { flexDirection: rowDirection }]}>
        <FooterLink
          label={locale === 'ar' ? 'عن المنصة' : 'About'}
          onPress={() => router.push('/about')}
        />
        <FooterLink
          label={locale === 'ar' ? 'سياسة الخصوصية' : 'Privacy policy'}
          onPress={() => openFeature('privacy')}
        />
        <FooterLink
          label={locale === 'ar' ? 'الشروط والأحكام' : 'Terms'}
          onPress={() => openFeature('terms')}
        />
      </View>

      <Modal
        animationType="slide"
        onRequestClose={() => setLinkSheetOpen(false)}
        transparent
        visible={linkSheetOpen}
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
            testID="home-custom-link-sheet"
          >
            <View style={[styles.sheetHeader, { flexDirection: rowDirection }]}>
              <AppText variant="heading">
                {editingId === null
                  ? locale === 'ar'
                    ? 'إضافة رابط'
                    : 'Add link'
                  : locale === 'ar'
                    ? 'تعديل الرابط'
                    : 'Edit link'}
              </AppText>
              <Pressable
                accessibilityLabel={locale === 'ar' ? 'إغلاق' : 'Close'}
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => setLinkSheetOpen(false)}
                testID="home-close-link-sheet"
              >
                <X color={theme.palette.foreground} size={22} />
              </Pressable>
            </View>
            <View style={[styles.sheetRow, { flexDirection: rowDirection }]}>
              <AppInput
                accessibilityLabel={locale === 'ar' ? 'رمز الرابط' : 'Link icon'}
                maxLength={12}
                onChangeText={setCustomIcon}
                style={styles.iconInput}
                testID="home-custom-link-icon"
                value={customIcon}
              />
              <AppInput
                accessibilityLabel={locale === 'ar' ? 'اسم الرابط' : 'Link name'}
                maxLength={80}
                onChangeText={setCustomName}
                placeholder={locale === 'ar' ? 'الاسم' : 'Name'}
                style={styles.nameInput}
                testID="home-custom-link-name"
                value={customName}
              />
            </View>
            <AppInput
              accessibilityLabel={locale === 'ar' ? 'عنوان الرابط' : 'Link URL'}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={2048}
              onChangeText={setCustomUrl}
              placeholder="https://example.com"
              testID="home-custom-link-url"
              value={customUrl}
            />
            {customLinkError ? (
              <AppText color="danger" variant="caption">
                {customLinkError}
              </AppText>
            ) : null}
            <AppButton
              icon={<Plus color={theme.palette.primaryForeground} size={18} />}
              onPress={() => void saveCustomLink()}
              testID="home-add-custom-link"
            >
              {editingId === null
                ? locale === 'ar'
                  ? 'إضافة رابط'
                  : 'Add link'
                : locale === 'ar'
                  ? 'حفظ'
                  : 'Save'}
            </AppButton>
          </SafeAreaView>
        </View>
      </Modal>
    </Screen>
    </View>
  );
}

function GridCard({
  badge,
  icon,
  label,
  onPress,
}: {
  badge?: ReactNode;
  icon: ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.gridItem, { opacity: pressed ? 0.65 : 1 }]}
    >
      <AppCard style={styles.gridCard}>
        {icon}
        <AppText numberOfLines={2} style={styles.gridLabel} variant="caption">
          {label}
        </AppText>
      </AppCard>
      {badge}
    </Pressable>
  );
}

function SmallButton({
  active = false,
  icon,
  label,
  onPress,
  testID,
}: {
  active?: boolean;
  icon: ReactNode;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  const { direction } = useLocale();
  const { theme } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.smallButton,
        {
          backgroundColor: active
            ? theme.palette.primary
            : theme.palette.surfaceRaised,
          borderColor: theme.palette.border,
          flexDirection: direction === 'rtl' ? 'row-reverse' : 'row',
          opacity: pressed ? 0.7 : 1,
        },
      ]}
      testID={testID}
    >
      {icon}
      <AppText
        style={
          active ? { color: theme.palette.primaryForeground } : undefined
        }
        variant="caption"
      >
        {label}
      </AppText>
    </Pressable>
  );
}

function FooterLink({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" hitSlop={6} onPress={onPress}>
      <AppText color="muted" variant="caption">
        {label}
      </AppText>
    </Pressable>
  );
}

function ProviderChoice({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  const { theme } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.providerChoice,
        {
          backgroundColor: active ? theme.palette.surfaceRaised : theme.palette.surface,
          borderColor: active ? theme.palette.primary : theme.palette.border,
          opacity: pressed ? 0.65 : 1,
        },
      ]}
    >
      <AppText variant="caption">{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badgeEnd: {
    right: 4,
  },
  badgeStart: {
    left: 4,
  },
  centered: {
    textAlign: 'center',
  },
  clockCard: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: 20,
  },
  clockTime: {
    fontSize: 40,
    lineHeight: 56,
  },
  emoji: {
    fontSize: 26,
    lineHeight: 30,
  },
  emptyLinks: {
    alignItems: 'center',
    borderStyle: 'dashed',
    gap: 12,
    paddingVertical: 28,
  },
  favicon: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  faviconImage: {
    height: 22,
    width: 22,
  },
  footer: {
    columnGap: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingVertical: 8,
    rowGap: 6,
  },
  grid: {
    flexWrap: 'wrap',
    gap: 10,
  },
  gridCard: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
    justifyContent: 'center',
    minHeight: 96,
    padding: 10,
  },
  gridItem: {
    flexBasis: '31%',
    flexGrow: 0,
  },
  gridLabel: {
    textAlign: 'center',
  },
  iconButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  iconInput: {
    textAlign: 'center',
    width: 64,
  },
  logo: {
    height: 48,
    width: 92,
  },
  logoRow: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  nameInput: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  providerChoice: {
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  providerRow: {
    flexWrap: 'wrap',
    gap: 6,
  },
  page: {
    flex: 1,
  },
  removeBadge: {
    alignItems: 'center',
    borderRadius: 12,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    top: 4,
    width: 24,
  },
  searchCard: {
    gap: 10,
  },
  searchInput: {
    flex: 1,
  },
  searchRow: {
    gap: 8,
  },
  sectionActions: {
    gap: 8,
  },
  sectionHeader: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  sheetHeader: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetRow: {
    gap: 8,
  },
  smallButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
  },
  topActions: {
    alignItems: 'center',
    gap: 4,
  },
  topRow: {
    alignItems: 'center',
    height: 64,
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  widgetCard: {
    flex: 1,
    gap: 4,
  },
  widgets: {
    alignItems: 'stretch',
    gap: 10,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Home.tsx (1722 lines)
  confidence: high
  todos:      0
  notes:      Follows the website start page order: controls, logo, clock and
              widgets, search, events, link grids, personal links, footer. The
              emergency banner and the extra tools grid are native-only; the
              grid replaces the website's two separate preset sections because
              the API returns one merged quick-link list.
*/
