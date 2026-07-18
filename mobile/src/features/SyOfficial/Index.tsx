import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Camera,
  Globe2,
  Link2,
  MessageCircle,
  MessageSquare,
  Send,
  Users,
  Video,
} from 'lucide-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  DirectoryCard,
  DirectoryFilterChips,
  DirectoryImage,
  DirectoryLinkAction,
  DirectoryScreen,
  DirectorySearchField,
  DirectoryViewToggle,
  getDirectoryQueryPresentation,
} from '@/components/directory';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';
import {
  directoryQueryKeys,
  fetchOfficialAccounts,
} from '@/lib/api/directories';

import {
  filterAndSortOfficialEntities,
  getOfficialCategoryLabel,
  getOfficialDescription,
  getOfficialImageUrl,
  getOfficialName,
  groupOfficialEntities,
  isOfficialRtl,
  OFFICIAL_CATEGORIES,
  type OfficialLanguage,
  type OfficialSort,
} from './logic';
import type { OfficialEntity } from './types';

type ViewMode = 'grid' | 'table';

interface OfficialTranslations {
  cached: string;
  clearSearch: string;
  description: string;
  error: string;
  errorTitle: string;
  grid: string;
  loading: string;
  imageRetry: string;
  imageUnavailable: string;
  noResults: string;
  noResultsDesc: string;
  searchPlaceholder: string;
  retry: string;
  socialTelegramList: string;
  socialTwitterList: string;
  sortBy: string;
  sortCategory: string;
  sortNameAsc: string;
  sortNameDesc: string;
  table: string;
  title: string;
  view: string;
}

const TRANSLATIONS: Record<OfficialLanguage, OfficialTranslations> = {
  ar: {
    cached: 'تعذر تحديث الدليل. يتم عرض آخر بيانات محفوظة.',
    clearSearch: 'مسح البحث',
    description:
      'دليل وسائل التواصل الاجتماعي للجهات السورية الرسمية - اضغط على اسم الجهة للوصول إلى صفحاتها الرسمية',
    error: 'تعذر تحميل الحسابات الرسمية. تحقق من اتصالك وحاول مرة أخرى.',
    errorTitle: 'تعذر تحميل البيانات',
    grid: 'شبكة',
    loading: 'جاري تحميل الحسابات الرسمية...',
    imageRetry: 'إعادة المحاولة',
    imageUnavailable: 'صورة غير متاحة',
    noResults: 'لم يتم العثور على حسابات رسمية',
    noResultsDesc: 'جرب تعديل كلمات البحث أو الفلاتر.',
    searchPlaceholder: 'ابحث في الحسابات الرسمية بالاسم أو الوصف...',
    retry: 'إعادة المحاولة',
    socialTelegramList: 'قائمة تلغرام',
    socialTwitterList: 'قائمة تويتر',
    sortBy: 'ترتيب حسب',
    sortCategory: 'الفئة',
    sortNameAsc: 'الاسم (أ-ي)',
    sortNameDesc: 'الاسم (ي-أ)',
    table: 'جدول',
    title: 'روابط الحسابات الرسمية السورية',
    view: 'عرض',
  },
  en: {
    cached: 'The directory could not refresh. Showing the last saved data.',
    clearSearch: 'Clear search',
    description:
      'Social media directory for Syrian official entities - Click on the entity name to visit their official pages',
    error: 'Official accounts could not load. Check your connection and retry.',
    errorTitle: 'Could not load data',
    grid: 'Grid',
    loading: 'Loading official accounts...',
    imageRetry: 'Retry image',
    imageUnavailable: 'Image unavailable',
    noResults: 'No official accounts found',
    noResultsDesc: 'Try adjusting your search terms or filters.',
    searchPlaceholder: 'Search official accounts by name or description...',
    retry: 'Retry',
    socialTelegramList: 'Telegram List',
    socialTwitterList: 'Twitter List',
    sortBy: 'Sort by',
    sortCategory: 'Category',
    sortNameAsc: 'Name (A-Z)',
    sortNameDesc: 'Name (Z-A)',
    table: 'Table',
    title: 'Syrian Official Accounts Links',
    view: 'View',
  },
  tr: {
    cached: 'Dizin yenilenemedi. Son kaydedilen veriler gösteriliyor.',
    clearSearch: 'Aramayı temizle',
    description:
      'Suriye resmi kurumlarının sosyal medya rehberi - Resmi sayfalarına ulaşmak için kurum adına tıklayın',
    error: 'Resmi hesaplar yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.',
    errorTitle: 'Veriler yüklenemedi',
    grid: 'Izgara',
    loading: 'Yükleniyor...',
    imageRetry: 'Görseli yeniden dene',
    imageUnavailable: 'Görsel kullanılamıyor',
    noResults: 'Resmi hesap bulunamadı',
    noResultsDesc: 'Arama terimlerini veya filtreleri değiştirmeyi deneyin.',
    searchPlaceholder: 'İsim veya açıklama ile arayın...',
    retry: 'Tekrar dene',
    socialTelegramList: 'Telegram Listesi',
    socialTwitterList: 'Twitter Listesi',
    sortBy: 'Sıralama',
    sortCategory: 'Kategori',
    sortNameAsc: 'İsim (A-Z)',
    sortNameDesc: 'İsim (Z-A)',
    table: 'Tablo',
    title: 'Suriye Resmi Hesap Bağlantıları',
    view: 'Görünüm',
  },
  ku: {
    cached: 'Peldank nehate nûkirin. Daneyên dawî tên nîşandan.',
    clearSearch: 'Lêgerînê paqij bike',
    description:
      'Rêberê medyaya civakî ji bo saziyên fermî yên Sûriyê - Li ser navê saziyê bitikînin da ku hûn bigihîjin rûpelên wan ên fermî',
    error: 'Hesabên fermî nehatin barkirin. Girêdana xwe kontrol bikin.',
    errorTitle: 'Dane nehatin barkirin',
    grid: 'Tor',
    loading: 'Tê barkirin...',
    imageRetry: 'Wêneyê dîsa biceribîne',
    imageUnavailable: 'Wêne ne berdest e',
    noResults: 'Hesabên fermî nehatin dîtin',
    noResultsDesc: 'Hewl bidin ku peyvên lêgerînê an fîlteran biguherînin.',
    searchPlaceholder: 'Li gorî nav an ravekirinê bigerin...',
    retry: 'Dîsa biceribîne',
    socialTelegramList: 'Lîsteya Telegram',
    socialTwitterList: 'Lîsteya Twitter',
    sortBy: 'Rêzkirin',
    sortCategory: 'Kategorî',
    sortNameAsc: 'Nav (A-Z)',
    sortNameDesc: 'Nav (Z-A)',
    table: 'Tablo',
    title: 'Girêdanên Hesabên Fermî yên Sûriyê',
    view: 'Dîtin',
  },
};

const LANGUAGE_OPTIONS: readonly {
  label: string;
  value: OfficialLanguage;
}[] = [
  { label: '🇸🇾 AR', value: 'ar' },
  { label: '🇬🇧 EN', value: 'en' },
  { label: '🇹🇷 TR', value: 'tr' },
  { label: '☀️ KU', value: 'ku' },
];

const X_LIST_URL = 'https://x.com/i/lists/1906101934660174006';
const TELEGRAM_LIST_URL = 'https://t.me/addlist/fKrhEy2yNeEwODQ0';

export default function Index() {
  const [language, setLanguage] = useState<OfficialLanguage>('ar');
  const t = TRANSLATIONS[language];
  const rtl = isOfficialRtl(language);
  const query = useQuery({
    queryFn: ({ signal }) => fetchOfficialAccounts({ signal }),
    queryKey: directoryQueryKeys.officialAccounts,
  });
  const entities = query.data;
  const state = getDirectoryQueryPresentation(query);
  const retry = () => {
    void query.refetch();
  };

  return (
    <DirectoryScreen
      cachedWarning={state.cached ? t.cached : undefined}
      direction={rtl ? 'rtl' : 'ltr'}
      errorDetail={state.error ? t.error : undefined}
      errorTitle={t.errorTitle}
      isLoading={state.loading}
      loadingLabel={t.loading}
      onRetry={retry}
      refreshing={state.refreshing}
      retryLabel={t.retry}
      subtitle={t.description}
      textAlign={rtl ? 'right' : 'left'}
      title={t.title}
    >
      {entities ? (
        <OfficialDirectory
          entities={entities}
          language={language}
          onLanguageChange={setLanguage}
        />
      ) : null}
    </DirectoryScreen>
  );
}

export function OfficialDirectory({
  entities,
  language,
  onLanguageChange,
}: {
  entities: readonly OfficialEntity[];
  language: OfficialLanguage;
  onLanguageChange: (language: OfficialLanguage) => void;
}) {
  const { theme } = useAppTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentCategory, setCurrentCategory] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortOption, setSortOption] = useState<OfficialSort>('name-asc');
  const rtl = isOfficialRtl(language);
  const textAlign = rtl ? 'right' : 'left';
  const t = TRANSLATIONS[language];
  const filteredEntities = useMemo(
    () =>
      filterAndSortOfficialEntities(entities, {
        category: currentCategory,
        language,
        search: searchTerm,
        sort: sortOption,
      }),
    [currentCategory, entities, language, searchTerm, sortOption],
  );
  const groups = useMemo(
    () => groupOfficialEntities(filteredEntities, currentCategory),
    [currentCategory, filteredEntities],
  );

  return (
    <View style={[styles.screen, { direction: rtl ? 'rtl' : 'ltr' }]}>
      <View style={styles.featuredLinks}>
        <DirectoryLinkAction
          icon={<MessageSquare color={theme.palette.foreground} size={17} />}
          label={t.socialTwitterList}
          url={X_LIST_URL}
        />
        <DirectoryLinkAction
          icon={<Send color={theme.palette.foreground} size={17} />}
          label={t.socialTelegramList}
          url={TELEGRAM_LIST_URL}
        />
      </View>

      <DirectoryFilterChips
        direction={rtl ? 'rtl' : 'ltr'}
        label="Language"
        onSelect={onLanguageChange}
        options={LANGUAGE_OPTIONS}
        selected={language}
      />

      <DirectorySearchField
        accessibilityLabel={t.searchPlaceholder}
        clearAccessibilityLabel={t.clearSearch}
        onChangeText={setSearchTerm}
        placeholder={t.searchPlaceholder}
        textAlign={textAlign}
        value={searchTerm}
      />

      <DirectoryFilterChips
        direction={rtl ? 'rtl' : 'ltr'}
        onSelect={setCurrentCategory}
        options={OFFICIAL_CATEGORIES.map((category) => ({
          label:
            language === 'ar' ? category.label.ar : category.label.en,
          value: category.key,
        }))}
        selected={currentCategory}
      />

      <View style={styles.controls}>
        <AppText color="muted" style={{ textAlign }} variant="caption">
          {filteredEntities.length > 0
            ? language === 'ar'
              ? `عرض ${filteredEntities.length} حساب رسمي`
              : `Showing ${filteredEntities.length} official accounts`
            : t.noResults}
        </AppText>
        <DirectoryViewToggle
          first={{ label: t.grid, value: 'grid' }}
          onChange={setViewMode}
          second={{ label: t.table, value: 'table' }}
          value={viewMode}
        />
      </View>

      <DirectoryFilterChips
        direction={rtl ? 'rtl' : 'ltr'}
        label={t.sortBy}
        onSelect={setSortOption}
        options={[
          { label: t.sortNameAsc, value: 'name-asc' },
          { label: t.sortNameDesc, value: 'name-desc' },
          { label: t.sortCategory, value: 'category' },
        ]}
        selected={sortOption}
      />

      {filteredEntities.length === 0 ? (
        <AppCard style={styles.empty}>
          <Users color={theme.palette.mutedForeground} size={40} />
          <AppText style={{ textAlign }} variant="heading">
            {t.noResults}
          </AppText>
          <AppText color="muted" style={{ textAlign }}>
            {t.noResultsDesc}
          </AppText>
        </AppCard>
      ) : viewMode === 'grid' ? (
        <View style={styles.groups}>
          {groups.map(([category, items]) => (
            <View key={category} style={styles.group}>
              {currentCategory === 'all' ? (
                <AppText style={{ textAlign }} variant="heading">
                  {getOfficialCategoryLabel(category, language)}
                </AppText>
              ) : null}
              <View style={styles.grid}>
                {items.map((item) => (
                  <View key={item.id} style={styles.gridItem}>
                    <OfficialCard
                      item={item}
                      language={language}
                      mode="grid"
                    />
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.list}>
          {filteredEntities.map((item) => (
            <OfficialCard
              item={item}
              key={item.id}
              language={language}
              mode="table"
            />
          ))}
        </View>
      )}
    </View>
  );
}

function OfficialCard({
  item,
  language,
  mode,
}: {
  item: OfficialEntity;
  language: OfficialLanguage;
  mode: ViewMode;
}) {
  const { theme } = useAppTheme();
  const rtl = isOfficialRtl(language);
  const compact = mode === 'table';

  return (
    <DirectoryCard
      actions={
        <>
          {Object.entries(item.socials).map(([platform, url]) => (
            <DirectoryLinkAction
              icon={socialIcon(platform, theme.palette.foreground)}
              key={platform}
              label={platform}
              url={url}
            />
          ))}
        </>
      }
      badges={
        compact ? [getOfficialCategoryLabel(item.category, language)] : []
      }
      compact={compact}
      media={
        <DirectoryImage
          accessibilityLabel={getOfficialName(item, language)}
          retryLabel={TRANSLATIONS[language].imageRetry}
          style={compact ? styles.tableImage : styles.officialImage}
          uri={getOfficialImageUrl(item.image)}
          unavailableLabel={TRANSLATIONS[language].imageUnavailable}
        />
      }
      subtitle={getOfficialDescription(item, language)}
      textAlign={rtl ? 'right' : 'left'}
      title={getOfficialName(item, language)}
    />
  );
}

function socialIcon(platform: string, color: string): ReactNode {
  switch (platform.toLowerCase()) {
    case 'facebook':
      return <Users color={color} size={16} />;
    case 'twitter':
      return <MessageSquare color={color} size={16} />;
    case 'instagram':
      return <Camera color={color} size={16} />;
    case 'linkedin':
      return <Building2 color={color} size={16} />;
    case 'telegram':
      return <Send color={color} size={16} />;
    case 'youtube':
      return <Video color={color} size={16} />;
    case 'whatsapp':
      return <MessageCircle color={color} size={16} />;
    case 'website':
      return <Globe2 color={color} size={16} />;
    default:
      return <Link2 color={color} size={16} />;
  }
}

const styles = StyleSheet.create({
  controls: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  empty: {
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
    minHeight: 220,
  },
  featuredLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridItem: {
    minWidth: 150,
    width: '48%',
  },
  group: {
    gap: 10,
  },
  groups: {
    gap: 24,
  },
  list: {
    gap: 10,
  },
  officialImage: {
    height: 150,
  },
  screen: {
    gap: 16,
  },
  tableImage: {
    height: 58,
    width: 58,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/SyOfficial/Index.tsx (479 lines)
  confidence: high
  todos:      0
  notes:      Four local languages, grouped ordering, safe social links, and native query states are preserved.
*/
