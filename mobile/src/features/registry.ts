import type { LucideIcon } from 'lucide-react-native';
import {
  BarChart3,
  Bus,
  CalendarDays,
  CheckCircle2,
  CircleHelp,
  Code2,
  Compass,
  ContactRound,
  FileText,
  Globe2,
  Landmark,
  Link,
  LayoutDashboard,
  ListOrdered,
  MapPinned,
  Palette,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Soup,
  Users2,
} from 'lucide-react-native';

export interface FeatureDefinition {
  descriptionAr: string;
  descriptionEn: string;
  icon: LucideIcon;
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
    icon: LayoutDashboard,
  },
  {
    slug: 'syofficial',
    labelAr: 'الحسابات الرسمية',
    labelEn: 'Official accounts',
    descriptionAr: 'حسابات المؤسسات السورية الموثقة',
    descriptionEn: 'Verified Syrian institution accounts',
    icon: CheckCircle2,
  },
  {
    slug: 'roznama',
    labelAr: 'الروزنامة',
    labelEn: 'Calendar',
    descriptionAr: 'أحداث ومناسبات وذاكرة سورية',
    descriptionEn: 'Events, observances, and Syrian memory',
    icon: CalendarDays,
  },
  {
    slug: 'phonebook',
    labelAr: 'دليل الهاتف',
    labelEn: 'Phonebook',
    descriptionAr: 'أرقام الطوارئ والخدمات العامة',
    descriptionEn: 'Emergency and public service numbers',
    icon: ContactRound,
  },
  {
    slug: 'syid',
    labelAr: 'الهوية البصرية',
    labelEn: 'Visual identity',
    descriptionAr: 'دليل الهوية السورية وملفاتها',
    descriptionEn: 'Syrian identity guide and assets',
    icon: Palette,
  },
  {
    slug: 'party',
    labelAr: 'دليل الأحزاب',
    labelEn: 'Organizations',
    descriptionAr: 'الأحزاب والمبادرات السياسية',
    descriptionEn: 'Political parties and initiatives',
    icon: Users2,
  },
  {
    slug: 'tierlist',
    labelAr: 'تقييم الحكومة',
    labelEn: 'Government ranking',
    descriptionAr: 'قيّم الأداء وتابع النتائج',
    descriptionEn: 'Rank performance and follow results',
    icon: ListOrdered,
  },
  {
    slug: 'house',
    labelAr: 'المجلس التشريعي',
    labelEn: 'Legislative council',
    descriptionAr: 'بيانات المرشحين والفائزين',
    descriptionEn: 'Candidate and winner data',
    icon: Landmark,
  },
  {
    slug: 'compass',
    labelAr: 'البوصلة السياسية',
    labelEn: 'Political compass',
    descriptionAr: 'اختبار توجهات مبني على قضايا سورية',
    descriptionEn: 'Issue-based political orientation test',
    icon: Compass,
  },
  {
    slug: 'priorities',
    labelAr: 'أولويات سوريا',
    labelEn: 'Syria priorities',
    descriptionAr: 'رتب الأولويات وشارك رؤيتك',
    descriptionEn: 'Rank priorities and share your view',
    icon: SlidersHorizontal,
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
    icon: Link,
  },
  {
    slug: 'population',
    labelAr: 'أطلس سوريا',
    labelEn: 'Syria atlas',
    descriptionAr: 'السكان والمناخ والأمطار على الخريطة',
    descriptionEn: 'Population, climate, and rainfall maps',
    icon: Globe2,
  },
  {
    slug: 'govapps',
    labelAr: 'تطبيقات الحكومة',
    labelEn: 'Government apps',
    descriptionAr: 'التطبيقات الرسمية وروابط تنزيلها',
    descriptionEn: 'Official apps and download links',
    icon: Smartphone,
  },
  {
    slug: 'transit',
    labelAr: 'ترانزيت',
    labelEn: 'Transit',
    descriptionAr: 'خطوط النقل والمحطات القريبة',
    descriptionEn: 'Transit routes and nearby stops',
    icon: Bus,
  },
  {
    slug: 'places',
    labelAr: 'مشوار',
    labelEn: 'Mishwar',
    descriptionAr: 'خريطة تفاعلية لأماكن تستحق المشوار في سوريا',
    descriptionEn: 'An interactive map of Syrian places worth the trip',
    icon: MapPinned,
  },
  {
    slug: 'justice',
    labelAr: 'العدالة الانتقالية',
    labelEn: 'Transitional justice',
    descriptionAr: 'سجل المعتقلين ومسارات العدالة',
    descriptionEn: 'Detainee records and justice paths',
    icon: Scale,
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
    icon: Soup,
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
  source:     resources/js/Components/Icons/ProjectIcons.tsx (316 lines)
  confidence: high
  todos:      0
  notes:      The native feature registry assigns semantic Lucide icons to the corresponding project modules.
*/
