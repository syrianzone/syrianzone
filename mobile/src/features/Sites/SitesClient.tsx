import { Image } from 'expo-image';
import { ExternalLink, FilterX, Globe2, Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  DirectoryCard,
  DirectoryFilterChips,
  DirectoryLinkAction,
  DirectorySearchField,
  DirectoryViewToggle,
} from '@/components/directory';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';
import { isSafeExternalUrl, openSafeExternalUrl } from '@/lib/linking';

import {
  filterWebsites,
  getWebsiteCategories,
  getWebsiteFaviconUrl,
  getWebsiteTypeDisplayName,
  SITES_PAGE_SIZE,
} from './data';
import type { Website } from './types';

const ADD_SITE_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSdIu8TFwSmT7fHxzsVlOwt35X9Myfhg0RZ6jwEkIMxxvyctqA/viewform';

interface SitesClientProps {
  initialWebsites: readonly Website[];
}

export default function SitesClient({ initialWebsites }: SitesClientProps) {
  const { theme } = useAppTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [displayCount, setDisplayCount] = useState(SITES_PAGE_SIZE);
  const categories = useMemo(
    () => getWebsiteCategories(initialWebsites),
    [initialWebsites],
  );
  const filteredWebsites = useMemo(
    () =>
      filterWebsites(initialWebsites, {
        search: searchTerm,
        type: typeFilter,
      }),
    [initialWebsites, searchTerm, typeFilter],
  );
  const displayedWebsites = filteredWebsites.slice(0, displayCount);

  const clearFilters = () => {
    setSearchTerm('');
    setTypeFilter('');
    setDisplayCount(SITES_PAGE_SIZE);
  };

  const updateSearch = (value: string) => {
    setSearchTerm(value);
    setDisplayCount(SITES_PAGE_SIZE);
  };

  const updateType = (value: string) => {
    setTypeFilter(value);
    setDisplayCount(SITES_PAGE_SIZE);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.addAction}>
        <DirectoryLinkAction
          icon={<Plus color={theme.palette.foreground} size={17} />}
          label="إضافة موقع جديد"
          url={ADD_SITE_URL}
        />
      </View>

      <DirectorySearchField
        accessibilityLabel="البحث في المواقع السورية"
        onChangeText={updateSearch}
        placeholder="ابحث في المواقع السورية..."
        value={searchTerm}
      />

      <DirectoryFilterChips
        label="نوع الموقع"
        onSelect={updateType}
        options={[
          { label: 'جميع الأنواع', value: '' },
          ...categories.map((category) => ({
            label: getWebsiteTypeDisplayName(category),
            value: category,
          })),
        ]}
        selected={typeFilter}
      />

      <View style={styles.controls}>
        <AppText color="muted" variant="caption">
          {filteredWebsites.length === 0
            ? 'لم يتم العثور على نتائج'
            : `عرض ${displayedWebsites.length} من أصل ${filteredWebsites.length} موقع`}
        </AppText>
        <DirectoryViewToggle
          first={{ label: 'بطاقات', value: 'grid' }}
          onChange={setViewMode}
          second={{ label: 'قائمة', value: 'table' }}
          value={viewMode}
        />
      </View>

      {searchTerm || typeFilter ? (
        <AppButton
          icon={<FilterX color={theme.palette.foreground} size={18} />}
          onPress={clearFilters}
          variant="secondary"
        >
          مسح الفلاتر
        </AppButton>
      ) : null}

      {filteredWebsites.length === 0 ? (
        <AppCard style={styles.empty}>
          <Globe2 color={theme.palette.mutedForeground} size={40} />
          <AppText variant="heading">لم يتم العثور على مواقع</AppText>
          <AppText color="muted">
            جرب تغيير مصطلحات البحث أو الفلاتر
          </AppText>
          <AppButton onPress={clearFilters} variant="ghost">
            مسح جميع الفلاتر
          </AppButton>
        </AppCard>
      ) : (
        <View style={viewMode === 'grid' ? styles.grid : styles.list}>
          {displayedWebsites.map((site) => {
            const safe = isSafeExternalUrl(site.url);
            const card = (
              <DirectoryCard
                actions={
                  viewMode === 'table' ? (
                    <DirectoryLinkAction
                      icon={
                        <ExternalLink
                          color={theme.palette.foreground}
                          size={16}
                        />
                      }
                      label="زيارة"
                      url={site.url}
                    />
                  ) : undefined
                }
                badges={site.type ? [getWebsiteTypeDisplayName(site.type)] : []}
                compact={viewMode === 'table'}
                media={
                  <SiteFavicon compact={viewMode === 'table'} site={site} />
                }
                onPress={
                  viewMode === 'grid' && safe
                    ? () => {
                        void openSafeExternalUrl(site.url).catch(() => false);
                      }
                    : undefined
                }
                subtitle={site.description}
                title={site.name}
              />
            );
            return (
              <View
                key={site.id}
                style={viewMode === 'grid' ? styles.gridItem : undefined}
              >
                {card}
              </View>
            );
          })}
        </View>
      )}

      {displayedWebsites.length < filteredWebsites.length ? (
        <AppButton
          onPress={() =>
            setDisplayCount((current) => current + SITES_PAGE_SIZE)
          }
        >
          تحميل المزيد
        </AppButton>
      ) : null}

      <AppCard style={styles.about}>
        <AppText variant="heading">حول المواقع السورية</AppText>
        <AppText color="muted">
          دليل شامل للمواقع السورية في مختلف المجالات، يهدف إلى تسهيل
          الوصول إلى المحتوى السوري الرقمي.
        </AppText>
      </AppCard>
    </View>
  );
}

// The list mode shows the same mark as the grid so a row is identifiable at a
// glance; a site without a favicon keeps the bundled globe instead of a gap.
function SiteFavicon({ compact, site }: { compact: boolean; site: Website }) {
  const { theme } = useAppTheme();
  const [failed, setFailed] = useState(false);
  const favicon = getWebsiteFaviconUrl(site.url);

  return (
    <View
      accessibilityLabel={`أيقونة ${site.name}`}
      style={[
        compact ? styles.siteFrameCompact : styles.siteFrame,
        { backgroundColor: theme.palette.surfaceRaised },
      ]}
      testID={`site-favicon-${site.id}`}
    >
      {favicon && !failed ? (
        <Image
          cachePolicy="memory-disk"
          contentFit="contain"
          onError={() => setFailed(true)}
          source={{ uri: favicon }}
          style={compact ? styles.siteIconCompact : styles.siteIcon}
          testID={`site-favicon-image-${site.id}`}
          transition={150}
        />
      ) : (
        <Globe2
          color={theme.palette.mutedForeground}
          size={compact ? 20 : 30}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  about: {
    gap: 8,
    marginTop: 14,
  },
  addAction: {
    alignItems: 'center',
  },
  controls: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  empty: {
    alignItems: 'center',
    gap: 10,
    minHeight: 220,
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridItem: {
    minWidth: 150,
    width: '48%',
  },
  list: {
    gap: 10,
  },
  screen: {
    gap: 16,
  },
  siteFrame: {
    alignItems: 'center',
    borderRadius: 14,
    height: 88,
    justifyContent: 'center',
  },
  siteFrameCompact: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    borderRadius: 10,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  siteIcon: {
    borderRadius: 8,
    height: 38,
    width: 38,
  },
  siteIconCompact: {
    borderRadius: 6,
    height: 22,
    width: 22,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Sites/SitesClient.tsx (319 lines)
  confidence: high
  todos:      0
  notes:      First-party favicons in both view modes, exact filter chips, table mode, and pagination preserve final source behavior.
*/
