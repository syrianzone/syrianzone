import { LegalDocument } from '@/components/content/LegalDocument';
import { useLocale } from '@/contexts/LocaleContext';

const arabicSections = [
  {
    title: 'مقدمة عامة',
    paragraphs: [
      'تلتزم منصة المساحة السورية بحماية خصوصية مستخدميها. نحن منصة مفتوحة المصادر وغير تجارية، نهدف إلى تقديم أدوات تفاعلية وموارد مفتوحة للشعب السوري.',
      'توضح هذه السياسة نوع البيانات التي نجمعها، وكيفية استخدامها، والتحكم الذي تمتلكه في بياناتك عند استخدام الاستطلاعات والترانزيت وألعاب الأقران.',
    ],
  },
  {
    title: 'حسابات المستخدمين والمصادقة',
    paragraphs: [
      'تسجيل الدخول عبر Google اختياري ويسمح بإدارة المساهمات ومسودات خطوط النقل والمواقف. لا يتطلب تصفح التطبيق أو التصويت إنشاء حساب.',
      'نجمع الاسم الكامل والبريد الإلكتروني ومعرف Google ورابط الصورة الشخصية لغرض المصادقة وإدارة الحساب والمساهمات فقط.',
      'يمكنك حذف حسابك نهائياً من لوحة الحساب. عند الحذف نمسح الاسم والبريد الإلكتروني ومعرف Google والصورة الشخصية، ونلغي رموز الدخول، ونحتفظ فقط بسجلات مساهمة مجهولة عند الحاجة لحماية سلامة المحتوى.',
    ],
  },
  {
    title: 'البيانات التي نقوم بتخزينها',
    paragraphs: [
      'لا يتطلب التصويت تسجيل الدخول. لحماية نزاهة النتائج يحتفظ التطبيق بمعرف تثبيت عشوائي، ويخزن الخادم بصمات مشفرة لمعرف التثبيت وعنوان الشبكة ونوع العميل لمدة تصل إلى 30 يوماً. نحد أيضاً عدد الأصوات اليومية من الشبكة الواحدة. بعد انتهاء المدة نحذف الإيصال ونمسح هذه البصمات من بطاقة الاقتراع، مع إبقاء الاختيارات مجهولة لاحتساب النتائج.',
      'عند اقتراح مسارات أو مواقف نقل، نحفظ المسودة ليتسنى للمشرفين مراجعتها واعتمادها.',
    ],
  },
  {
    title: 'الموقع الجغرافي واتصال الأقران',
    paragraphs: [
      'يطلب الترانزيت صلاحية الموقع عند اختيارك عرض المحطات القريبة. يرسل التطبيق الإحداثيات إلى واجهة المساحة السورية لحساب المسافات، ولا يضيفها إلى حسابك أو سجل موقع دائم.',
      'تستخدم لعبة Guess Who تقنية WebRTC لربط اللاعبين مباشرة. يحتفظ خادم التنسيق بحالة الغرفة المؤقتة حتى انتهاء الجلسة ويمرر رسائل الإشارة، بينما تنتقل وسائط الاتصال مباشرة بين الجهازين ولا نسجل محتواها.',
    ],
  },
  {
    title: 'أدوات الطرف الثالث',
    paragraphs: [
      'نستخدم Google OAuth للمصادقة، وPusher أو WebSockets للإشارات اللحظية، وMapLibre وOpenStreetMap للخرائط، وF3alia للفعاليات.',
      'نرسل الإحداثيات المطلوبة فقط إلى AlAdhan لحساب الصلاة وإلى خدمة الطقس لجلب الحالة المحلية. يرسل بحثك مباشرة إلى محرك البحث الذي تختاره ولا نخزنه.',
    ],
  },
] as const;

const englishSections = [
  {
    title: 'Introduction',
    paragraphs: [
      'Syrian Zone is committed to protecting user privacy. We are an open-source, non-commercial platform providing interactive tools and open resources for the Syrian community.',
      'This policy explains what data we collect, how we use it, and the controls available when using polls, Transit, and peer-to-peer games.',
    ],
  },
  {
    title: 'User accounts and authentication',
    paragraphs: [
      'Google sign-in is optional and enables contribution and Transit draft management. Browsing and voting do not require an account.',
      'We collect your full name, email address, Google subject identifier, and avatar URL only for authentication and account or contribution management.',
      'You can permanently delete your account from the dashboard. Deletion erases your name, email, Google identifier, and avatar, revokes access tokens, and retains only anonymized contribution records where content integrity requires them.',
    ],
  },
  {
    title: 'Data we store',
    paragraphs: [
      'Voting does not require sign-in. To protect results, the app keeps a random installation identifier and the server stores keyed fingerprints of the installation, network address, and client type for up to 30 days. We also limit daily ballots from one network. After 30 days, the receipt is deleted and these fingerprints are scrubbed from the ballot while anonymous choices remain available for result calculation.',
      'When you propose transit routes or stops, the submission is stored as a draft for administrator review.',
    ],
  },
  {
    title: 'Location and peer-to-peer features',
    paragraphs: [
      'Transit requests location access only when you ask for nearby stops. The app sends coordinates to the Syrian Zone API to calculate distances, but does not attach them to your account or create a persistent location history.',
      'Guess Who uses WebRTC for direct player connectivity. The coordination server keeps temporary room state until the session expires and relays signaling messages. Communication media travels directly between devices, and we do not record its content.',
    ],
  },
  {
    title: 'Third-party services',
    paragraphs: [
      'We use Google OAuth for authentication, Pusher or WebSockets for signaling, MapLibre and OpenStreetMap for maps, and F3alia for events.',
      'Requested coordinates are sent to AlAdhan for prayer times and to the weather provider for local conditions. Search queries go directly to your chosen search provider and are not stored by Syrian Zone.',
    ],
  },
] as const;

export default function PrivacyScreen() {
  const { locale } = useLocale();
  return (
    <LegalDocument
      intro={
        locale === 'ar'
          ? 'آخر تحديث: يوليو 2026'
          : 'Last updated: July 2026'
      }
      sections={locale === 'ar' ? arabicSections : englishSections}
      title={locale === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy'}
    />
  );
}

/*
PORT STATUS
  source:     resources/js/Pages/Privacy.tsx (300 lines)
  confidence: high
  todos:      0
  notes:      Native bilingual sections preserve account, voting, location, WebRTC, and provider disclosures.
*/
