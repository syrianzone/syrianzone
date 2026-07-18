export const locales = ['ar', 'en'] as const;
export type Locale = (typeof locales)[number];

export const strings = {
  ar: {
    appName: 'المساحة السورية',
    back: 'رجوع',
    cached: 'بيانات محفوظة',
    cancel: 'إلغاء',
    close: 'إغلاق',
    empty: 'لا توجد نتائج',
    error: 'تعذر إكمال الطلب',
    loading: 'جار التحميل',
    offline: 'أنت غير متصل بالإنترنت',
    retry: 'إعادة المحاولة',
    save: 'حفظ',
    search: 'بحث',
    settings: 'الإعدادات',
    signIn: 'تسجيل الدخول عبر جوجل',
    signOut: 'تسجيل الخروج',
  },
  en: {
    appName: 'Syrian Zone',
    back: 'Back',
    cached: 'Saved data',
    cancel: 'Cancel',
    close: 'Close',
    empty: 'No results',
    error: 'The request could not be completed',
    loading: 'Loading',
    offline: 'You are offline',
    retry: 'Try again',
    save: 'Save',
    search: 'Search',
    settings: 'Settings',
    signIn: 'Sign in with Google',
    signOut: 'Sign out',
  },
} as const;

export type StringKey = keyof (typeof strings)['ar'];

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && locales.includes(value as Locale);
}
