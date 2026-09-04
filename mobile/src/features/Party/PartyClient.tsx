import {
  ExternalLink,
  FileText,
  Globe2,
  MapPin,
  Plus,
  Send,
  Users,
} from 'lucide-react-native';
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

import {
  filterOrganizations,
  formatSocialUrl,
  getLanguageName,
  getPartyFilterOptions,
  PARTY_PAGE_SIZE,
  type PartyFilters,
  type SocialPlatform,
} from './data';
import type { Organization } from './types';

const ADD_ORGANIZATION_URL = 'https://forms.gle/vLAxoz5RNt6z6qyj9';
const NO_FILTERS: PartyFilters = {
  category: 'all',
  city: 'all',
  country: 'all',
  language: 'all',
  search: '',
};

interface PartyClientProps {
  initialOrganizations: readonly Organization[];
}

export default function PartyClient({
  initialOrganizations,
}: PartyClientProps) {
  const { theme } = useAppTheme();
  const [filters, setFilters] = useState<PartyFilters>({ ...NO_FILTERS });
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [displayCount, setDisplayCount] = useState(PARTY_PAGE_SIZE);

  const categories = useMemo(
    () => getPartyFilterOptions(initialOrganizations, 'type'),
    [initialOrganizations],
  );
  const countries = useMemo(
    () => getPartyFilterOptions(initialOrganizations, 'country'),
    [initialOrganizations],
  );
  const cities = useMemo(
    () => getPartyFilterOptions(initialOrganizations, 'city'),
    [initialOrganizations],
  );
  const languages = useMemo(
    () => getPartyFilterOptions(initialOrganizations, 'lang'),
    [initialOrganizations],
  );
  const filteredOrganizations = useMemo(
    () => filterOrganizations(initialOrganizations, filters),
    [filters, initialOrganizations],
  );
  const displayedOrganizations = filteredOrganizations.slice(0, displayCount);
  const filtersActive =
    filters.category !== 'all' ||
    filters.country !== 'all' ||
    filters.city !== 'all' ||
    filters.language !== 'all' ||
    Boolean(filters.search);

  // The website snaps back to the first slice whenever a filter or the search
  // changes, so a wide list never carries a stale count into new results.
  const updateFilter = (key: keyof PartyFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setDisplayCount(PARTY_PAGE_SIZE);
  };

  const clearFilters = () => {
    setFilters({ ...NO_FILTERS });
    setDisplayCount(PARTY_PAGE_SIZE);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.addAction}>
        <DirectoryLinkAction
          icon={<Plus color={theme.palette.foreground} size={17} />}
          label="إضافة منظمة جديدة"
          url={ADD_ORGANIZATION_URL}
        />
      </View>

      <DirectorySearchField
        accessibilityLabel="البحث في المنظمات السياسية"
        onChangeText={(value) => updateFilter('search', value)}
        placeholder="ابحث بالاسم أو النوع أو المكان..."
        value={filters.search}
      />

      <DirectoryFilterChips
        label="نوع المنظمة"
        onSelect={(value) => updateFilter('category', value)}
        options={withAll('جميع الأنواع', categories)}
        selected={filters.category}
      />
      <DirectoryFilterChips
        label="البلد"
        onSelect={(value) => updateFilter('country', value)}
        options={withAll('جميع البلدان', countries)}
        selected={filters.country}
      />
      <DirectoryFilterChips
        label="المدينة"
        onSelect={(value) => updateFilter('city', value)}
        options={withAll('جميع المدن', cities)}
        selected={filters.city}
      />
      <DirectoryFilterChips
        label="اللغة"
        onSelect={(value) => updateFilter('language', value)}
        options={[
          { label: 'جميع اللغات', value: 'all' },
          ...languages.map((language) => ({
            label: getLanguageName(language),
            value: language,
          })),
        ]}
        selected={filters.language}
      />

      {filtersActive ? (
        <AppButton onPress={clearFilters} variant="secondary">
          مسح الفلاتر
        </AppButton>
      ) : null}

      <View style={styles.controls}>
        <AppText color="muted" variant="caption">
          {filteredOrganizations.length === 0
            ? 'لم يتم العثور على نتائج'
            : `عرض ${displayedOrganizations.length} من أصل ${filteredOrganizations.length} منظمة`}
        </AppText>
        <DirectoryViewToggle
          first={{ label: 'بطاقات', value: 'grid' }}
          onChange={setViewMode}
          second={{ label: 'قائمة', value: 'table' }}
          value={viewMode}
        />
      </View>

      {filteredOrganizations.length === 0 ? (
        <AppCard style={styles.empty}>
          <Users color={theme.palette.mutedForeground} size={40} />
          <AppText variant="heading">لم يتم العثور على منظمات</AppText>
          <AppText color="muted">
            جرب تغيير مصطلحات البحث أو الفلاتر
          </AppText>
          <AppButton onPress={clearFilters} variant="ghost">
            مسح جميع الفلاتر
          </AppButton>
        </AppCard>
      ) : (
        <View style={styles.list}>
          {displayedOrganizations.map((organization) => (
            <OrganizationCard
              compact={viewMode === 'table'}
              key={organization.id}
              organization={organization}
            />
          ))}
        </View>
      )}

      {displayedOrganizations.length < filteredOrganizations.length ? (
        <AppButton
          onPress={() =>
            setDisplayCount((current) => current + PARTY_PAGE_SIZE)
          }
        >
          تحميل المزيد
        </AppButton>
      ) : null}

      <AppCard style={styles.about}>
        <AppText variant="heading">
          حول دليل المنظمات السياسية السورية
        </AppText>
        <AppText color="muted">
          يعتبر دليل المنظمات السياسية السورية مرجعاً شاملاً للتعرف على
          المنظمات والأحزاب والحركات السياسية السورية العاملة في مختلف أنحاء
          العالم.
        </AppText>
        <DirectoryLinkAction
          label="إرسال طلب إضافة للقائمة"
          url={ADD_ORGANIZATION_URL}
        />
      </AppCard>
    </View>
  );
}

function withAll(label: string, values: readonly string[]) {
  return [
    { label, value: 'all' },
    ...values.map((value) => ({ label: value, value })),
  ];
}

function OrganizationCard({
  compact,
  organization,
}: {
  compact: boolean;
  organization: Organization;
}) {
  const { theme } = useAppTheme();
  const socials: readonly {
    label: string;
    platform: SocialPlatform;
    url: string | undefined;
  }[] = compact
    ? [
        { label: 'X', platform: 'x', url: organization.socialX },
        {
          label: 'فيسبوك',
          platform: 'facebook',
          url: organization.socialFb,
        },
      ]
    : [
        {
          label: 'فيسبوك',
          platform: 'facebook',
          url: organization.socialFb,
        },
        { label: 'X', platform: 'x', url: organization.socialX },
        {
          label: 'إنستغرام',
          platform: 'instagram',
          url: organization.socialInsta,
        },
        {
          label: 'يوتيوب',
          platform: 'youtube',
          url: organization.youtube,
        },
        {
          label: 'تلغرام',
          platform: 'telegram',
          url: organization.telegram,
        },
      ];

  return (
    <DirectoryCard
      actions={
        <>
          <DirectoryLinkAction
            icon={<Globe2 color={theme.palette.foreground} size={16} />}
            label="الموقع"
            url={organization.website}
          />
          {!compact ? (
            <DirectoryLinkAction
              icon={<FileText color={theme.palette.foreground} size={16} />}
              label="البيان التأسيسي"
              url={organization.manifesto}
            />
          ) : null}
          {socials.map((social) => (
            <DirectoryLinkAction
              icon={socialIcon(social.platform, theme.palette.foreground)}
              key={social.platform}
              label={social.label}
              url={
                social.url
                  ? formatSocialUrl(social.platform, social.url)
                  : undefined
              }
            />
          ))}
        </>
      }
      badges={[
        ...(organization.type ? [organization.type] : []),
        ...(organization.politicalLeanings ?? []),
      ]}
      compact={compact}
      subtitle={organization.description}
      title={organization.name}
    >
      {organization.formattedLocation ? (
        <View style={styles.infoRow}>
          <MapPin color={theme.palette.primary} size={16} />
          <AppText color="muted" style={styles.infoText} variant="caption">
            {organization.formattedLocation}
          </AppText>
        </View>
      ) : null}
      {!compact && organization.mvpMembers ? (
        <View style={styles.infoRow}>
          <Users color={theme.palette.primary} size={16} />
          <AppText color="muted" style={styles.infoText} variant="caption">
            {organization.mvpMembers}
          </AppText>
        </View>
      ) : null}
    </DirectoryCard>
  );
}

function socialIcon(platform: SocialPlatform, color: string) {
  return platform === 'telegram' ? (
    <Send color={color} size={16} />
  ) : (
    <ExternalLink color={color} size={16} />
  );
}

const styles = StyleSheet.create({
  about: {
    gap: 10,
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
    justifyContent: 'center',
    minHeight: 220,
  },
  infoRow: {
    alignItems: 'flex-start',
    flexDirection: 'row-reverse',
    gap: 7,
  },
  infoText: {
    flex: 1,
  },
  list: {
    gap: 12,
  },
  screen: {
    gap: 16,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Party/PartyClient.tsx (440 lines)
  confidence: high
  todos:      0
  notes:      Native controls preserve exact filters, source ordering, responsive cards, the header add call to action, and the source pagination reset.
*/
