import {
  extractAppleAppId,
  extractGooglePlayPackage,
  getGovAppIconUrl,
} from '@/features/GovApps/data';
import {
  filterAndSortOrganizations,
  formatSocialUrl,
  getLanguageName,
  getPartyFilterOptions,
} from '@/features/Party/data';
import {
  filterPhonebookEntries,
  getPhonebookCategories,
  getTelephoneUrl,
  getWhatsAppUrl,
} from '@/features/Phonebook/logic';
import {
  filterAndSortWebsites,
  getWebsiteCategories,
  getWebsiteTypeDisplayName,
} from '@/features/Sites/data';
import {
  filterAndSortOfficialEntities,
  getOfficialDescription,
  getOfficialCategoryLabel,
  getOfficialImageUrl,
  getOfficialName,
  groupOfficialEntities,
  isOfficialRtl,
} from '@/features/SyOfficial/logic';

import {
  governmentAppsFixture,
  officialDirectoryFixture,
  organizationFixture,
  phonebookFixture,
  websiteFixture,
} from './fixtures/directories';

describe('official account source behavior', () => {
  it('searches both languages and does not mutate source ordering', () => {
    const sourceOrder = officialDirectoryFixture.map((item) => item.id);
    const result = filterAndSortOfficialEntities(officialDirectoryFixture, {
      category: 'all',
      language: 'ar',
      search: 'health',
      sort: 'name-desc',
    });

    expect(result.map((item) => item.id)).toEqual(['health-ministry']);
    expect(officialDirectoryFixture.map((item) => item.id)).toEqual(sourceOrder);
  });

  it('keeps source localization rules for Turkish and Kurdish', () => {
    const item = officialDirectoryFixture[0];
    expect(item).toBeDefined();
    if (!item) {
      return;
    }

    expect(getOfficialName(item, 'tr')).toBe('Ministry of Health');
    expect(getOfficialName(item, 'ku')).toBe('Ministry of Health');
    expect(getOfficialDescription(item, 'ar')).toBe(
      'الخدمات والإعلانات الصحية العامة',
    );
    expect(isOfficialRtl('ku')).toBe(true);
    expect(isOfficialRtl('tr')).toBe(false);
  });

  it('groups in the declared order and moves unknown categories to other', () => {
    const groups = groupOfficialEntities(officialDirectoryFixture, 'all');
    expect(groups.map(([key]) => key)).toEqual([
      'governorates',
      'ministries',
      'other',
    ]);
    expect(groups.at(-1)?.[1].map((item) => item.id)).toEqual(['new-body']);
  });

  it('covers category, selected-group, and server image fallbacks', () => {
    expect(getOfficialCategoryLabel('unknown', 'en')).toBe('unknown');
    expect(getOfficialCategoryLabel('ministries', 'en')).toBe('Ministries');
    expect(
      groupOfficialEntities(officialDirectoryFixture, 'ministries'),
    ).toEqual([['ministries', [...officialDirectoryFixture]]]);
    expect(getOfficialImageUrl('')).toBeNull();
    expect(getOfficialImageUrl('/syofficial-assets/images/health.png')).toContain(
      '/syofficial-assets/images/health.png',
    );
  });

  it('filters exact categories and covers category and reverse sorting', () => {
    expect(
      filterAndSortOfficialEntities(officialDirectoryFixture, {
        category: 'ministries',
        language: 'en',
        search: '',
        sort: 'category',
      }).map((item) => item.id),
    ).toEqual(['health-ministry']);
    expect(
      filterAndSortOfficialEntities(officialDirectoryFixture, {
        category: 'all',
        language: 'en',
        search: '',
        sort: 'name-desc',
      }),
    ).toHaveLength(3);
  });
});

describe('phonebook source behavior', () => {
  it('preserves first-seen categories and places short numbers first', () => {
    expect(getPhonebookCategories(phonebookFixture).map((item) => item.key)).toEqual([
      'all',
      'health_services',
      'emergency',
    ]);
    expect(
      filterPhonebookEntries(phonebookFixture, 'all', '').map((item) => item.id),
    ).toEqual(['emergency', 'hospital', 'health-whatsapp']);
  });

  it('normalizes number search, calling, and Syrian WhatsApp links', () => {
    expect(
      filterPhonebookEntries(phonebookFixture, 'all', '963112123456').map(
        (item) => item.id,
      ),
    ).toEqual(['hospital']);
    expect(getTelephoneUrl('+963 (11) 212-3456')).toBe(
      'tel:+96311212-3456'.replace('-', ''),
    );
    expect(getWhatsAppUrl('0933 123 456')).toBe('https://wa.me/963933123456');
    expect(getWhatsAppUrl('00963 933 123 456')).toBe(
      'https://wa.me/963933123456',
    );
    expect(getWhatsAppUrl('963933123456')).toBe(
      'https://wa.me/963933123456',
    );
  });
});

describe('sites source behavior', () => {
  it('filters by exact raw type while mapping display labels', () => {
    const result = filterAndSortWebsites(websiteFixture, {
      search: '',
      sort: 'name',
      type: 'مبادرة خدمية',
    });
    expect(result.map((site) => site.id)).toEqual(['site-services']);
    expect(getWebsiteTypeDisplayName('مبادرة خدمية')).toBe(
      'المواقع التعريفية',
    );
    expect(getWebsiteTypeDisplayName('مجلة إخبارية')).toBe(
      'المدونات والمواقع الإخبارية',
    );
    expect(getWebsiteTypeDisplayName('مدونة شخصية')).toBe(
      'المدونات الشخصية',
    );
  });

  it('derives sorted categories and searches URLs', () => {
    expect(getWebsiteCategories(websiteFixture)).toHaveLength(3);
    expect(
      filterAndSortWebsites(websiteFixture, {
        search: 'news.example',
        sort: 'type',
        type: '',
      }).map((site) => site.id),
    ).toEqual(['site-news']);
    expect(
      filterAndSortWebsites(websiteFixture, {
        search: '',
        sort: 'name-desc',
        type: '',
      }),
    ).toHaveLength(3);
    expect(getWebsiteTypeDisplayName('دليل')).toBe('دليل');
  });
});

describe('party source behavior', () => {
  const allFilters = {
    category: 'all',
    city: 'all',
    country: 'all',
    language: 'all',
    search: '',
    sort: 'name' as const,
  };

  it('applies exact filters and searches formatted locations', () => {
    expect(
      filterAndSortOrganizations(organizationFixture, {
        ...allFilters,
        country: 'ألمانيا',
      }).map((organization) => organization.id),
    ).toEqual(['diaspora-initiative']);
    expect(
      filterAndSortOrganizations(organizationFixture, {
        ...allFilters,
        search: 'القامشلي',
      }).map((organization) => organization.id),
    ).toEqual(['local-movement']);
  });

  it('formats social handles and language labels', () => {
    expect(formatSocialUrl('x', '@civicparty')).toBe(
      'https://x.com/civicparty',
    );
    expect(formatSocialUrl('telegram', 'https://t.me/already')).toBe(
      'https://t.me/already',
    );
    expect(getLanguageName('KU')).toBe('Kurdish');
    expect(getLanguageName('FR')).toBe('FR');
    expect(getPartyFilterOptions(organizationFixture, 'country')).toEqual([
      'ألمانيا',
      'سوريا',
    ]);
    expect(formatSocialUrl('x', '')).toBe('');
  });

  it.each(['name-desc', 'category', 'country', 'city'] as const)(
    'sorts organizations with the %s option',
    (sort) => {
      expect(
        filterAndSortOrganizations(organizationFixture, {
          ...allFilters,
          sort,
        }),
      ).toHaveLength(3);
    },
  );
});

describe('government app source behavior', () => {
  it('extracts Google Play and Apple identifiers', () => {
    const app = governmentAppsFixture[0];
    expect(app).toBeDefined();
    if (!app) {
      return;
    }
    expect(extractGooglePlayPackage(app.links.android ?? '')).toBe(
      'sy.gov.services',
    );
    expect(extractAppleAppId(app.links.apple ?? '')).toBe('123456789');
    expect(extractAppleAppId('https://example.com/no-id')).toBeNull();
  });

  it('prioritizes a resolved store icon over first-party media', () => {
    const app = governmentAppsFixture[0];
    expect(app).toBeDefined();
    if (!app) {
      return;
    }
    expect(getGovAppIconUrl(app, 'https://cdn.example.com/store.png')).toBe(
      'https://cdn.example.com/store.png',
    );
    expect(getGovAppIconUrl(app)).toContain(
      '/assets/apps/services/servicesicon.png',
    );
  });
});
