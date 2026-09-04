import {
  BarChart3,
  CircleHelp,
  Code2,
  FileText,
  Sandwich,
  ShieldCheck,
} from 'lucide-react-native';

import {
  BoardIcon,
  CompassIcon,
  type FeatureIcon,
  GovAppsIcon,
  HouseIcon,
  JusticeIcon,
  MishwarIcon,
  PartyIcon,
  PhonebookIcon,
  PopulationIcon,
  PrioritiesIcon,
  RoznamaIcon,
  SitesIcon,
  SyIdIcon,
  SyOfficialIcon,
  TierlistIcon,
  TransitIcon,
  WarningsIcon,
} from '@/components/icons/ProjectIcons';

export interface FeatureDefinition {
  descriptionAr: string;
  descriptionEn: string;
  icon: FeatureIcon;
  labelAr: string;
  labelEn: string;
  protected?: boolean;
  slug: string;
}

export const featureRegistry: readonly FeatureDefinition[] = [
  {
    slug: 'board',
    labelAr: 'لوح',
    labelEn: 'Board',
    descriptionAr: 'لوحات شخصية تجمع أدواتك اليومية',
    descriptionEn: 'Personal boards for your everyday tools',
    icon: BoardIcon,
  },
  {
    slug: 'syofficial',
    labelAr: 'الحسابات الرسمية',
    labelEn: 'Official accounts',
    descriptionAr: 'حسابات المؤسسات السورية الموثقة',
    descriptionEn: 'Verified Syrian institution accounts',
    icon: SyOfficialIcon,
  },
  {
    slug: 'roznama',
    labelAr: 'الروزنامة',
    labelEn: 'Calendar',
    descriptionAr: 'أحداث ومناسبات وذاكرة سورية',
    descriptionEn: 'Events, observances, and Syrian memory',
    icon: RoznamaIcon,
  },
  {
    slug: 'phonebook',
    labelAr: 'دليل الهاتف',
    labelEn: 'Phonebook',
    descriptionAr: 'أرقام الطوارئ والخدمات العامة',
    descriptionEn: 'Emergency and public service numbers',
    icon: PhonebookIcon,
  },
  {
    slug: 'warnings',
    labelAr: 'تنبيهات الطوارئ',
    labelEn: 'Emergency alerts',
    descriptionAr: 'تحذيرات وزارة الطوارئ وإدارة الكوارث',
    descriptionEn: 'Alerts from the Ministry of Emergency and Disaster Management',
    icon: WarningsIcon,
  },
  {
    slug: 'syid',
    labelAr: 'الهوية البصرية',
    labelEn: 'Visual identity',
    descriptionAr: 'دليل الهوية السورية وملفاتها',
    descriptionEn: 'Syrian identity guide and assets',
    icon: SyIdIcon,
  },
  {
    slug: 'party',
    labelAr: 'دليل الأحزاب',
    labelEn: 'Organizations',
    descriptionAr: 'الأحزاب والمبادرات السياسية',
    descriptionEn: 'Political parties and initiatives',
    icon: PartyIcon,
  },
  {
    slug: 'tierlist',
    labelAr: 'تقييم الحكومة',
    labelEn: 'Government ranking',
    descriptionAr: 'قيّم الأداء وتابع النتائج',
    descriptionEn: 'Rank performance and follow results',
    icon: TierlistIcon,
  },
  {
    slug: 'house',
    labelAr: 'المجلس التشريعي',
    labelEn: 'Legislative council',
    descriptionAr: 'بيانات المرشحين والفائزين',
    descriptionEn: 'Candidate and winner data',
    icon: HouseIcon,
  },
  {
    slug: 'compass',
    labelAr: 'البوصلة السياسية',
    labelEn: 'Political compass',
    descriptionAr: 'اختبار توجهات مبني على قضايا سورية',
    descriptionEn: 'Issue-based political orientation test',
    icon: CompassIcon,
  },
  {
    slug: 'priorities',
    labelAr: 'أولويات سوريا',
    labelEn: 'Syria priorities',
    descriptionAr: 'رتب الأولويات وشارك رؤيتك',
    descriptionEn: 'Rank priorities and share your view',
    icon: PrioritiesIcon,
  },
  {
    slug: 'alignment',
    labelAr: 'بوصلة مخصصة',
    labelEn: 'Custom alignment',
    descriptionAr: 'قارن مواقفك مع محاور تختارها',
    descriptionEn: 'Compare positions on custom axes',
    icon: BarChart3,
  },
  {
    slug: 'sites',
    labelAr: 'دليل المواقع',
    labelEn: 'Web directory',
    descriptionAr: 'مواقع سورية مفيدة ومصنفة',
    descriptionEn: 'Useful categorized Syrian websites',
    icon: SitesIcon,
  },
  {
    slug: 'population',
    labelAr: 'أطلس سوريا',
    labelEn: 'Syria atlas',
    descriptionAr: 'السكان والمناخ والأمطار على الخريطة',
    descriptionEn: 'Population, climate, and rainfall maps',
    icon: PopulationIcon,
  },
  {
    slug: 'govapps',
    labelAr: 'تطبيقات الحكومة',
    labelEn: 'Government apps',
    descriptionAr: 'التطبيقات الرسمية وروابط تنزيلها',
    descriptionEn: 'Official apps and download links',
    icon: GovAppsIcon,
  },
  {
    slug: 'transit',
    labelAr: 'ترانزيت',
    labelEn: 'Transit',
    descriptionAr: 'خطوط النقل والمحطات القريبة',
    descriptionEn: 'Transit routes and nearby stops',
    icon: TransitIcon,
  },
  {
    slug: 'places',
    labelAr: 'مشوار',
    labelEn: 'Mishwar',
    descriptionAr: 'خريطة تفاعلية لأماكن تستحق المشوار في سوريا',
    descriptionEn: 'An interactive map of Syrian places worth the trip',
    icon: MishwarIcon,
  },
  {
    slug: 'justice',
    labelAr: 'العدالة الانتقالية',
    labelEn: 'Transitional justice',
    descriptionAr: 'سجل المعتقلين ومسارات العدالة',
    descriptionEn: 'Detainee records and justice paths',
    icon: JusticeIcon,
  },
  {
    slug: 'polls',
    labelAr: 'استطلاعات الرأي',
    labelEn: 'Polls',
    descriptionAr: 'شارك في الاستطلاعات وتابع النتائج',
    descriptionEn: 'Vote in polls and follow results',
    icon: CircleHelp,
  },
  {
    slug: 'guesswho',
    labelAr: 'احزر من',
    labelEn: 'Guess Who',
    descriptionAr: 'لعبة ثنائية مباشرة مع صديق',
    descriptionEn: 'A live two-player game with a friend',
    icon: CircleHelp,
  },
  {
    slug: 'contributors',
    labelAr: 'المساهمون',
    labelEn: 'Contributors',
    descriptionAr: 'الأشخاص الذين بنوا المساحة السورية',
    descriptionEn: 'People who built Syrian Zone',
    icon: Code2,
  },
  {
    slug: 'dashboard',
    labelAr: 'لوحة الحساب',
    labelEn: 'Dashboard',
    descriptionAr: 'مشاركاتك وإعدادات حسابك',
    descriptionEn: 'Your contributions and account settings',
    icon: ShieldCheck,
    protected: true,
  },
  {
    slug: 'shawarma',
    labelAr: 'تير ليست الشاورما',
    labelEn: 'Shawarma tier list',
    descriptionAr: 'الدليل المصيري لأفضل شاورما',
    descriptionEn: 'The decisive guide to the best shawarma',
    icon: Sandwich,
  },
  {
    slug: 'privacy',
    labelAr: 'الخصوصية',
    labelEn: 'Privacy',
    descriptionAr: 'كيف نتعامل مع بياناتك',
    descriptionEn: 'How your data is handled',
    icon: ShieldCheck,
  },
  {
    slug: 'terms',
    labelAr: 'الشروط',
    labelEn: 'Terms',
    descriptionAr: 'شروط استخدام المساحة السورية',
    descriptionEn: 'Syrian Zone terms of use',
    icon: FileText,
  },
] as const;

/*
PORT STATUS
  source:     resources/js/Components/Navbar.tsx (navLinks icon table) and resources/js/Components/Icons/ProjectIcons.tsx (316 lines)
  confidence: high
  todos:      0
  notes:      Every module the website draws with a ProjectIcons component uses the same native port here; contributors and shawarma keep the website's Lucide picks, and native-only modules keep semantic Lucide icons. The warnings entry precedes its screen, which another agent owns.
*/
