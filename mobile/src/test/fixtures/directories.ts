import type { GovApp } from '@/features/GovApps/types';
import type { Organization } from '@/features/Party/types';
import type { PhonebookEntry } from '@/features/Phonebook/logic';
import type { Website } from '@/features/Sites/types';
import type { OfficialEntity } from '@/features/SyOfficial/types';

// Source: resources/js/Pages/SyOfficial/Index.tsx and types.ts.
export const officialDirectoryFixture: readonly OfficialEntity[] = [
  {
    category: 'ministries',
    description: 'Public health services and announcements',
    description_ar: 'الخدمات والإعلانات الصحية العامة',
    id: 'health-ministry',
    image: 'images/health.png',
    name: 'Ministry of Health',
    name_ar: 'وزارة الصحة',
    socials: {
      facebook: 'https://facebook.com/syrianhealth',
      website: 'https://moh.gov.sy',
    },
  },
  {
    category: 'governorates',
    description: 'Official Damascus governorate account',
    description_ar: 'الحساب الرسمي لمحافظة دمشق',
    id: 'damascus',
    image: 'images/damascus.png',
    name: 'Damascus Governorate',
    name_ar: 'محافظة دمشق',
    socials: { telegram: 'https://t.me/damascus' },
  },
  {
    category: 'new_category',
    description: 'A newly listed official body',
    description_ar: 'جهة رسمية مدرجة حديثاً',
    id: 'new-body',
    image: '',
    name: 'New Official Body',
    name_ar: 'جهة رسمية جديدة',
    socials: { custom: 'https://example.com/new-body' },
  },
];

// Source: tests/Feature/MobilePublicApiTest.php.
export const officialAccountsResponseFixture = {
  data: {
    categories: [
      {
        icon: 'landmark',
        id: 'government',
        is_active: true,
        label_ar: 'الحكومة',
        label_en: 'Government',
        order_column: 1,
      },
    ],
    entities: [
      {
        category: 'government',
        description: 'Public health',
        description_ar: 'الصحة العامة',
        id: 'ministry-health',
        image: '/syofficial-assets/health.png',
        name: 'Health Ministry',
        name_ar: 'وزارة الصحة',
        socials: {
          facebook: 'https://facebook.example/health',
          telegram_secondary: 'https://t.me/health-news',
        },
      },
    ],
  },
} as const;

// Source: resources/js/Pages/Phonebook/Index.tsx.
export const phonebookFixture: readonly PhonebookEntry[] = [
  {
    category_ar: 'الخدمات الصحية',
    category_en: 'Health Services',
    id: 'hospital',
    is_whatsapp: false,
    name_ar: 'مشفى المواساة',
    name_en: 'Al Mouwasat Hospital',
    number: '+963 (11) 212-3456',
    source_url: 'https://example.com/hospital-source',
  },
  {
    category_ar: 'الطوارئ',
    category_en: 'Emergency',
    id: 'emergency',
    is_whatsapp: false,
    name_ar: 'الإسعاف',
    name_en: 'Ambulance',
    number: '110',
    source_url: '',
  },
  {
    category_ar: 'الخدمات الصحية',
    category_en: 'Health Services',
    id: 'health-whatsapp',
    is_whatsapp: true,
    name_ar: 'خط الشكاوى الصحي',
    name_en: 'Health Complaints',
    number: '0933 123 456',
    source_url: 'https://example.com/health-source',
  },
];

// Source: resources/js/Pages/Sites/SitesClient.tsx and types.ts.
export const websiteFixture: readonly Website[] = [
  {
    description: 'منصة للخدمات المدنية السورية',
    id: 'site-services',
    name: 'بوابة الخدمات',
    type: 'مبادرة خدمية',
    url: 'https://services.example.com',
  },
  {
    description: 'أخبار محلية مستقلة',
    id: 'site-news',
    name: 'مجلة الشام',
    type: 'مجلة إخبارية',
    url: 'https://news.example.com',
  },
  {
    description: 'مقالات وتجارب شخصية',
    id: 'site-blog',
    name: 'مدونة ياسمين',
    type: 'مدونة شخصية',
    url: 'https://blog.example.com',
  },
];

export function makeWebsiteFixture(count: number): Website[] {
  return Array.from({ length: count }, (_, index) => ({
    description: `وصف الموقع رقم ${index + 1}`,
    id: `site-${index + 1}`,
    name: `موقع ${String(index + 1).padStart(2, '0')}`,
    type: index % 2 === 0 ? 'مبادرة خدمية' : 'مجلة إخبارية',
    url: `https://site-${index + 1}.example.com`,
  }));
}

// Source: resources/js/Pages/Party/PartyClient.tsx, data.ts, and types.ts.
export const organizationFixture: readonly Organization[] = [
  {
    city: 'دمشق',
    country: 'سوريا',
    description: 'حزب سياسي مدني يعمل في دمشق',
    formattedLocation: 'دمشق, سوريا',
    id: 'civic-party',
    lang: 'AR',
    manifesto: 'https://example.com/civic/manifesto',
    mvpMembers: 'ليلى الخطيب | سامر علي',
    name: 'الحزب المدني السوري',
    politicalLeanings: ['مدني', 'ديمقراطي'],
    socialFb: '@civicparty',
    socialInsta: '@civicparty',
    socialX: '@civicparty',
    telegram: '@civicparty',
    type: 'حزب',
    website: 'https://example.com/civic',
    youtube: '@civicparty',
  },
  {
    city: 'برلين',
    country: 'ألمانيا',
    description: 'مبادرة سياسية سورية في أوروبا',
    formattedLocation: 'برلين, ألمانيا',
    id: 'diaspora-initiative',
    lang: 'EN',
    name: 'المبادرة السورية الأوروبية',
    politicalLeanings: ['ليبرالي'],
    type: 'مبادرة',
    website: 'https://example.com/diaspora',
  },
  {
    city: 'القامشلي',
    country: 'سوريا',
    description: 'حركة سياسية محلية',
    formattedLocation: 'القامشلي, سوريا',
    id: 'local-movement',
    lang: 'KU',
    name: 'الحركة المحلية',
    politicalLeanings: [],
    type: 'حركة',
  },
];

export function makeOrganizationFixture(count: number): Organization[] {
  return Array.from({ length: count }, (_, index) => ({
    city: index % 2 === 0 ? 'دمشق' : 'حلب',
    country: 'سوريا',
    description: `وصف المنظمة رقم ${index + 1}`,
    formattedLocation: `${index % 2 === 0 ? 'دمشق' : 'حلب'}, سوريا`,
    id: `organization-${index + 1}`,
    lang: index % 2 === 0 ? 'AR' : 'EN',
    name: `منظمة ${String(index + 1).padStart(2, '0')}`,
    politicalLeanings: [],
    type: index % 2 === 0 ? 'حزب' : 'مبادرة',
  }));
}

// Source: resources/js/Pages/GovApps/GovAppsClient.tsx and types.ts.
export const governmentAppsFixture: readonly GovApp[] = [
  {
    description: 'تطبيق رسمي للوصول إلى الخدمات الحكومية الرقمية.',
    icon: '/assets/apps/services/servicesicon.png',
    id: 'services',
    images: [
      '/assets/apps/services/services1.png',
      '/assets/apps/services/services2.png',
    ],
    links: {
      android:
        'https://play.google.com/store/apps/details?id=sy.gov.services',
      apple: 'https://apps.apple.com/app/services/id123456789',
      official: 'https://services.gov.sy',
    },
    name: 'خدماتي',
  },
  {
    description: 'تطبيق حكومي دون روابط متجر.',
    icon: '',
    id: 'notices',
    images: [],
    links: {},
    name: 'البلاغات الرسمية',
  },
];
