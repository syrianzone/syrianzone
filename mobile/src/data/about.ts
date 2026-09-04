import type { Locale } from '@/lib/i18n/strings';

// The website About page is a stack of cards inside an Arabic/English tab pair.
// Native renders one column, so each card becomes a heading plus its copy, in
// the website's order: overview, founders, contributors, license, attributions.
// The attribution card is the CC BY 4.0 notice the bundled Streamline-derived
// icons require, so it must ship with the app, not only with the website.
export const aboutDocuments: Record<Locale, string> = {
  ar: `## عن المساحة السورية (Syrian Zone)

مبادرة تفاعلية مفتوحة وغير تجارية.

مرحبًا بكم في **المساحة السورية (Syrian Zone)**! هذا المشروع هو جهد تعاوني مفتوح المصدر يهدف إلى توفير أدوات وموارد متنوعة ومفيدة للمجتمع السوري.

نهدف من خلال هذا المشروع إلى بناء مساحة برمجية تتميز بالبساطة والقيمة العالية، وسهولة الوصول، والإطلاق السريع للأدوات المفتوحة التي تهم السوريين في الداخل والدول المجاورة ودول الاغتراب.

## الفريق المؤسس

بدأ المشروع بمبادرة وتطوير شخصي من:

- **هادي الأحمد** ([@hadealahmad](https://twitter.com/hadealahmad)) مؤسس ومطور رئيسي.
- **نور صوفناتي** ([@Nour_Sofanati](https://twitter.com/Nour_Sofanati)) مؤسس ومطور رئيسي.

## المساهمون والإسنادات (Contributors)

نخص بالذكر والشكر جميع المساهمين الرائعين في هذا المشروع:

- **مكدوس (@macdoos)** ساهم بتطوير قسم تقييم الوزراء والمسؤولين بالكامل.
- **الحارث الموسى (@tirh25)** قام بإضافة وتوثيق قاعدة بيانات الحسابات الرسمية السورية.
- **haiueida (@haiueida)** وفر الترجمة الكردية لصفحة الحسابات الرسمية.
- **Waleed Khamees (@WaleedKhamees)** ساهم في ضغط الصور وتحسين أداء سرعة الموقع.
- **SourceM7** ساهم بتطوير أطلس سوريا وتطوير وتصميم الصفحة الرئيسية.
- **وحيد شعّار (@WaheedShaar)** وفر النسخة الهندسية DWG للعلم السوري في الهوية البصرية.
- **عبدالرحمن حداد (@abd_hmh)** وفر الدليل الإرشادي لتفاصيل وأبعاد العلم السوري.
- **يوري دندشي (@yuri.dandashi)** تصميم الشعار وأيقونة الموقع والهوية البصرية العامة.

## مشروع مفتوح المصدر (MIT License)

هذا المشروع مرخص تحت رخصة **MIT License** الحرة ومتاحة شفرته المصدرية للجميع على منصة GitHub.

- [المستودع على GitHub](https://github.com/syrianzone/syrianzone)
- [تحميل الهوية البصرية (Brand Kit)](https://syrian.zone/assets/BrandKit.zip)

## حقوق الموارد والأيقونات (Attributions)

الأيقونات المستعملة في أدوات ومشاريع المنصة مأخوذة من مجموعات Streamline Icons ومتاحة بموجب رخصة Creative Commons Attribution 4.0 International (CC BY 4.0).`,
  en: `## About Syrian Zone

Non-commercial open-source community platform.

Welcome to **Syrian Zone (المساحة السورية)**! This project is an open-source collaborative effort aimed at building open resources, interactive tools, and data hubs for the Syrian community.

We aim to create high-value, accessible, and lightweight open software solutions for Syrians locally and across the diaspora.

## Founders

Initiated and maintained by:

- **Hadi Alahmad** ([@hadealahmad](https://twitter.com/hadealahmad)), co-founder and lead developer.
- **Nour Sofanati** ([@Nour_Sofanati](https://twitter.com/Nour_Sofanati)), co-founder and lead developer.

## Contributors & Credits

Special thanks to our awesome community contributors:

- **Makdoos (@macdoos)** developed the complete Cabinet Tierlist and evaluation feature.
- **Al-Harith Al-Mousa (@tirh25)** populated the official Syrian government accounts database.
- **haiueida (@haiueida)** provided Kurdish translations for SyOfficial.
- **Waleed Khamees (@WaleedKhamees)** optimized image compression and performance.
- **SourceM7** contributed to the Population Atlas and the homepage redesign.
- **Waheed Shaar (@WaheedShaar)** provided DWG CAD engineering vector files for the flag.
- **Abdulrahman Haddad (@abd_hmh)** supplied the flag proportion specification guidelines.
- **Yuri Dandashi (@yuri.dandashi)** designed the logo, brand identity, and site icons.

## Open Source Software (MIT License)

This software is licensed under the permissive **MIT License**. All codebase repositories are publicly accessible on GitHub.

- [GitHub Repository](https://github.com/syrianzone/syrianzone)
- [Download Brand Kit](https://syrian.zone/assets/BrandKit.zip)

## Resource Attributions

Tool and project icons are derived from Streamline Icons via Icones under Creative Commons Attribution 4.0 International (CC BY 4.0).`,
};

/*
PORT STATUS
  source:     resources/js/Pages/About.tsx (371 lines)
  confidence: high
  todos:      0
  notes:      Carries both language tabs of the current website About page, including the CC BY 4.0 icon attribution the app must ship with the bundled icons.
*/
