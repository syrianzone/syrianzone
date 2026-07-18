import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  CalendarDays,
  CloudSun,
  Clock3,
  ExternalLink,
  Plus,
  Search,
  Settings,
  Trash2,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import F3aliaEvents from '@/components/F3aliaEvents';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { Screen } from '@/components/ui/Screen';
import { useHomeSettings } from '@/contexts/HomeSettingsContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useAppTheme } from '@/contexts/ThemeContext';
import { featureRegistry } from '@/features/registry';
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
} from '@/lib/ported/home';

import {
  fetchHomeContent,
  type HomeQuickLink,
} from './Home/api';

const weatherTranslations: Readonly<Record<string, string>> = {
  'broken clouds': 'غيوم جزئية',
  'clear sky': 'سماء صافية',
  'few clouds': 'غيوم قليلة',
  'light rain': 'مطر خفيف',
  mist: 'ضباب',
  'moderate rain': 'مطر متوسط',
  'overcast clouds': 'غيوم ملبدة',
  rain: 'ممطر',
  'scattered clouds': 'غيوم متفرقة',
  'shower rain': 'مطر غزير',
  snow: 'مثلج',
  thunderstorm: 'عاصفة رعدية',
};

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

const defaultNow = () => new Date();

export interface HomeProps {
  liveClock?: boolean;
  now?: () => Date;
}

export default function Home({ liveClock = true, now = defaultNow }: HomeProps) {
  const { hydrated, settings, updateSettings } = useHomeSettings();
  const { direction, locale } = useLocale();
  const { theme } = useAppTheme();
  const [currentTime, setCurrentTime] = useState(now);
  const [search, setSearch] = useState('');
  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customIcon, setCustomIcon] = useState('🔗');
  const [customLinkError, setCustomLinkError] = useState<string | null>(null);
  const coordinates = resolveHomeCoordinates(settings);
  const governorate =
    governorates.find((item) => item.id === settings.governorate) ??
    governorates[0];

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
    (feature) => !quickFeatureTargets.has(feature.slug),
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
    router.push({
      pathname: '/feature/[slug]',
      params: { slug: link.target },
    });
  };

  const addCustomLink = async () => {
    if (settings.customLinks.length >= 24) {
      setCustomLinkError(
        locale === 'ar'
          ? 'وصلت إلى الحد الأقصى: 24 رابطاً.'
          : 'You have reached the limit of 24 personal links.',
      );
      return;
    }
    const parsed = customLinkSchema.safeParse({
      icon: customIcon.trim() || '🔗',
      id: `link-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
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
    setCustomLinkError(null);
    await updateSettings({
      customLinks: [...settings.customLinks, parsed.data],
    });
    setCustomName('');
    setCustomUrl('');
    setCustomIcon('🔗');
  };

  const removeCustomLink = async (id: string) => {
    await updateSettings({
      customLinks: settings.customLinks.filter((link) => link.id !== id),
    });
  };

  return (
    <Screen
      subtitle={
        locale === 'ar'
          ? 'أدوات ومراجع مفتوحة لكل السوريين'
          : 'Open tools and references for every Syrian'
      }
      title={locale === 'ar' ? 'أهلا بك' : 'Welcome'}
      trailing={
        <Pressable
          accessibilityLabel={locale === 'ar' ? 'الإعدادات' : 'Settings'}
          accessibilityRole="button"
          onPress={() => router.push('/settings')}
          style={styles.settingsButton}
        >
          <Settings color={theme.palette.foreground} size={24} />
        </Pressable>
      }
    >
      <View style={styles.widgets}>
        {settings.showWeather ? (
          <AppCard style={styles.widgetCard}>
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

        {settings.showClock ? (
          <AppCard style={styles.clockCard}>
            <Clock3 color={theme.palette.primary} size={25} />
            <AppText variant="title">
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
            <AppText color="muted" variant="caption">
              {currentTime.toLocaleDateString(
                locale === 'ar' ? 'ar-SY' : 'en-GB',
                { day: 'numeric', month: 'long', weekday: 'long', year: 'numeric' },
              )}
            </AppText>
            {hijriDate ? (
              <AppText color="primary" testID="home-hijri-date" variant="caption">
                {hijriDate}
              </AppText>
            ) : null}
          </AppCard>
        ) : null}

        {settings.showPrayerTimes ? (
          <AppCard style={styles.widgetCard}>
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

      {settings.useCustomCoordinates && settings.customCoordinates ? (
        <AppText color="muted" variant="caption">
          {locale === 'ar'
            ? `الطقس والصلاة حسب إحداثياتك ${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)}`
            : `Weather and prayer use ${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)}`}
        </AppText>
      ) : null}

      {settings.showSearch ? (
        <AppCard style={styles.searchCard}>
          <View style={styles.searchRow}>
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
          <View style={styles.providerRow}>
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
      <View style={[styles.linkGrid, { flexDirection: direction === 'rtl' ? 'row-reverse' : 'row' }]}>
        {quickLinks.map((link) => {
          const feature =
            link.type === 'feature'
              ? featureRegistry.find((item) => item.slug === link.target)
              : null;
          const Icon = feature?.icon ?? ExternalLink;
          return (
            <Pressable
              accessibilityRole="button"
              key={link.id}
              onPress={() => void openQuickLink(link)}
              style={({ pressed }) => [styles.linkPressable, { opacity: pressed ? 0.65 : 1 }]}
            >
              <AppCard style={styles.linkCard}>
                <Icon color={theme.palette.primary} size={25} />
                <AppText numberOfLines={2} variant="label">
                  {locale === 'ar' ? link.label_ar : link.label_en}
                </AppText>
              </AppCard>
            </Pressable>
          );
        })}
      </View>

      <AppCard style={styles.customLinksSection}>
        <AppText variant="heading">
          {locale === 'ar' ? 'روابطك المخصصة' : 'Your links'}
        </AppText>
        {settings.customLinks.map((link) => (
          <View key={link.id} style={styles.savedLinkRow}>
            <Pressable
              accessibilityRole="link"
              onPress={() => void openSafeExternalUrl(link.url)}
              style={styles.savedLink}
            >
              <AppText style={styles.linkIcon}>{link.icon}</AppText>
              <AppText style={styles.savedLinkName} variant="label">
                {link.name}
              </AppText>
            </Pressable>
            <Pressable
              accessibilityLabel={
                locale === 'ar' ? `حذف ${link.name}` : `Remove ${link.name}`
              }
              accessibilityRole="button"
              onPress={() => void removeCustomLink(link.id)}
              style={styles.removeButton}
              testID={`home-remove-custom-link-${link.id}`}
            >
              <Trash2 color={theme.palette.danger} size={20} />
            </Pressable>
          </View>
        ))}
        <View style={styles.customLinkInputs}>
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
            style={styles.customNameInput}
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
          onPress={() => void addCustomLink()}
          testID="home-add-custom-link"
        >
          {locale === 'ar' ? 'إضافة رابط' : 'Add link'}
        </AppButton>
      </AppCard>

      {additionalFeatures.length > 0 ? (
        <>
          <AppText variant="heading">
            {locale === 'ar' ? 'أدوات إضافية' : 'More tools'}
          </AppText>
          <View style={[styles.linkGrid, { flexDirection: direction === 'rtl' ? 'row-reverse' : 'row' }]}>
            {additionalFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={feature.slug}
                  onPress={() =>
                    router.push({
                      pathname: '/feature/[slug]',
                      params: { slug: feature.slug },
                    })
                  }
                  style={({ pressed }) => [styles.linkPressable, { opacity: pressed ? 0.65 : 1 }]}
                >
                  <AppCard style={styles.linkCard}>
                    <Icon color={theme.palette.primary} size={25} />
                    <AppText numberOfLines={2} variant="label">
                      {locale === 'ar' ? feature.labelAr : feature.labelEn}
                    </AppText>
                  </AppCard>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      <AppButton onPress={() => router.push('/about')} variant="ghost">
        {locale === 'ar' ? 'عن المساحة السورية' : 'About Syrian Zone'}
      </AppButton>
    </Screen>
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
  clockCard: {
    alignItems: 'center',
    flex: 2,
    gap: 2,
    minWidth: 210,
  },
  customLinkInputs: {
    flexDirection: 'row',
    gap: 8,
  },
  customLinksSection: {
    gap: 10,
  },
  customNameInput: {
    flex: 1,
  },
  iconInput: {
    textAlign: 'center',
    width: 64,
  },
  linkCard: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
    justifyContent: 'center',
    minHeight: 104,
  },
  linkGrid: {
    flexWrap: 'wrap',
    gap: 10,
  },
  linkIcon: {
    fontSize: 22,
  },
  linkPressable: {
    minWidth: 142,
    width: '47%',
  },
  providerChoice: {
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  providerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  removeButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  savedLink: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 48,
  },
  savedLinkName: {
    flex: 1,
  },
  savedLinkRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  searchCard: {
    gap: 10,
  },
  searchInput: {
    flex: 1,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  settingsButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  widgetCard: {
    flex: 1,
    gap: 4,
    minWidth: 145,
  },
  widgets: {
    alignItems: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Home.tsx (1326 lines)
  confidence: high
  todos:      0
  notes:      Native Home keeps configurable widgets, F3alia, search, source quick links, personal links, and location settings.
*/
