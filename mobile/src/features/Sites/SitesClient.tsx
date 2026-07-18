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
  filterAndSortWebsites,
  getWebsiteCategories,
  getWebsiteTypeDisplayName,
  SITES_PAGE_SIZE,
  type SiteSort,
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
  const [sortOption, setSortOption] = useState<SiteSort>('name');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [displayCount, setDisplayCount] = useState(SITES_PAGE_SIZE);
  const categories = useMemo(
    () => getWebsiteCategories(initialWebsites),
    [initialWebsites],
  );
  const filteredWebsites = useMemo(
    () =>
      filterAndSortWebsites(initialWebsites, {
        search: searchTerm,
        sort: sortOption,
        type: typeFilter,
      }),
    [initialWebsites, searchTerm, sortOption, typeFilter],
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

  const updateSort = (value: SiteSort) => {
    setSortOption(value);
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

      <DirectoryFilterChips
        label="ترتيب حسب"
        onSelect={updateSort}
        options={[
          { label: 'الاسم (أ-ي)', value: 'name' },
          { label: 'الاسم (ي-أ)', value: 'name-desc' },
          { label: 'النوع', value: 'type' },
        ]}
        selected={sortOption}
      />

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
                  viewMode === 'grid' ? (
                    <View
                      style={[
                        styles.sitePlaceholder,
                        { backgroundColor: theme.palette.surfaceRaised },
                      ]}
                    >
                      <Globe2 color={theme.palette.mutedForeground} size={38} />
                    </View>
                  ) : undefined
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
  sitePlaceholder: {
    alignItems: 'center',
    borderRadius: 14,
    height: 88,
    justifyContent: 'center',
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Sites/SitesClient.tsx (337 lines)
  confidence: high
  todos:      0
  notes:      Native cards use a globe placeholder and filter clearing restores all types.
*/
