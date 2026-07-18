import { LegalDocument } from '@/components/content/LegalDocument';
import { useLocale } from '@/contexts/LocaleContext';

const arabicSections = [
  {
    title: 'قبول الشروط والاستخدام العام',
    paragraphs: [
      'من خلال الوصول إلى المساحة السورية أو استخدام تطبيقها، فإنك توافق على الالتزام بهذه الشروط والأحكام بالكامل.',
      'نحن منصة مجتمعية مفتوحة المصادر وغير تجارية. جميع الأدوات والخدمات مجانية وتهدف إلى مساعدة المجتمع السوري وتسهيل الوصول إلى المعلومات.',
    ],
  },
  {
    title: 'حسابات المستخدمين والسلوك المقبول',
    paragraphs: [
      'عند إنشاء حساب عبر Google، تكون مسؤولاً عن النشاط الذي يتم من خلال حسابك.',
      'يمنع استخدام الروبوتات أو الحسابات المتعددة أو السكربتات لتزييف نتائج التصويت أو التقييمات. يحق للمنصة حظر الحسابات أو عناوين IP عند اكتشاف اختراق أو إغراق أو إساءة.',
      'يجب أن تكون المعلومات التي تقدمها في الأدلة أو مسارات الترانزيت صحيحة وواقعية.',
    ],
  },
  {
    title: 'استوديو الترانزيت وحقوق المساهمة',
    paragraphs: [
      'يتيح استوديو الترانزيت المساهمة في رسم خطوط النقل والمواقف العامة في المدن السورية.',
      'بإرسال مسودة، تمنح المساحة السورية حقاً دائماً وغير حصري ومجانياً لنشر البيانات وتعديلها ودمجها في خرائط النقل المفتوحة.',
    ],
  },
  {
    title: 'Guess Who والاتصالات',
    paragraphs: [
      'تستخدم اللعبة WebRTC للاتصال المباشر بين اللاعبين. يجب الالتزام بآداب الحوار ويحظر خطاب الكراهية والتحرش والمحتوى غير القانوني.',
      'لا نراقب الاتصال المباشر ولا نتحمل مسؤولية تصرفات أو أقوال اللاعبين أثناءه.',
    ],
  },
  {
    title: 'إخلاء المسؤولية وحدودها',
    paragraphs: [
      'تقدم المنصة وأدواتها كما هي دون ضمانات صريحة أو ضمنية.',
      'بيانات النقل ودليل الأرقام مجتمعية وقد تتغير. لا نضمن دقة المواعيد أو الأسعار أو الأرقام، ولا نتحمل مسؤولية انقطاع الخدمة أو فقدان البيانات بسبب الأعطال أو الصيانة.',
    ],
  },
] as const;

const englishSections = [
  {
    title: 'Acceptance of terms',
    paragraphs: [
      'By accessing Syrian Zone or using its app, you agree to these Terms and Conditions in full.',
      'We are an open-source, non-commercial community portal. All provided tools and services are free and intended to help the Syrian community access information.',
    ],
  },
  {
    title: 'Accounts and acceptable use',
    paragraphs: [
      'When signing in with Google, you are responsible for activity under your account.',
      'Bots, multiple identities, or automation may not be used to manipulate votes or evaluations. We may ban accounts or IP addresses involved in exploits, flooding, or abuse.',
      'Information submitted to directories or Transit must be accurate and factual.',
    ],
  },
  {
    title: 'Transit Studio contribution rights',
    paragraphs: [
      'Transit Studio lets you contribute routes and stops in Syrian cities.',
      'Submitting a draft grants Syrian Zone a perpetual, non-exclusive, royalty-free license to publish, modify, and integrate that data into open public transit maps.',
    ],
  },
  {
    title: 'Guess Who and conduct',
    paragraphs: [
      'The game uses WebRTC for direct player communication. Players must remain respectful. Hate speech, harassment, and illegal content are prohibited.',
      'We do not monitor direct peer communication and accept no liability for player behavior.',
    ],
  },
  {
    title: 'Disclaimers and liability',
    paragraphs: [
      'The platform and its tools are provided as is and as available without warranties of any kind.',
      'Transit and phone data are community-generated and may change. We do not guarantee routes, schedules, prices, or numbers and are not liable for downtime or technical data loss.',
    ],
  },
] as const;

export default function TermsScreen() {
  const { locale } = useLocale();
  return (
    <LegalDocument
      intro={
        locale === 'ar'
          ? 'يرجى قراءة هذه الشروط قبل استخدام المنصة'
          : 'Please read these terms before using the platform'
      }
      sections={locale === 'ar' ? arabicSections : englishSections}
      title={locale === 'ar' ? 'الشروط والأحكام' : 'Terms and Conditions'}
    />
  );
}

/*
PORT STATUS
  source:     resources/js/Pages/Terms.tsx (236 lines)
  confidence: high
  todos:      0
  notes:      Native bilingual sections preserve acceptable use, contribution, conduct, and liability terms.
*/
