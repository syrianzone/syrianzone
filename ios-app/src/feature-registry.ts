import { lazy, type ComponentType } from 'react';
import type { FeatureScreenProps } from './platform/features';

export const featureScreens: Record<string, { title: string; component: ComponentType<FeatureScreenProps> }> = {
  muslim: { title: 'الركن الإسلامي', component: lazy(() => import('./features/Muslim/Index').then(module => ({ default: module.MuslimScreen }))) },
  muslim_prayer: { title: 'مواقيت الصلاة', component: lazy(() => import('./features/Muslim/Prayer/Index').then(module => ({ default: module.PrayerScreen }))) },
  muslim_quran: { title: 'قارئ القرآن', component: lazy(() => import('./features/Muslim/Quran/Index').then(module => ({ default: module.QuranScreen }))) },
  muslim_radio: { title: 'إذاعة القرآن', component: lazy(() => import('./features/Muslim/Radio/Index').then(module => ({ default: module.RadioScreen }))) },
  hotels: { title: 'الفنادق', component: lazy(() => import('./features/Hotels/Index').then(module => ({ default: module.HotelsScreen }))) },
  hotel: { title: 'تفاصيل الفندق', component: lazy(() => import('./features/Hotels/Index').then(module => ({ default: module.HotelScreen }))) },
  guides: { title: 'المرشدون المحليون', component: lazy(() => import('./features/Guides/Index').then(module => ({ default: module.GuidesScreen }))) },
  transit_studio: { title: 'استوديو النقل', component: lazy(() => import('./features/TransitStudio/Index').then(module => ({ default: module.TransitStudioScreen }))) },
  account: { title: 'الحساب', component: lazy(() => import('./features/Account/Index').then(module => ({ default: module.AccountScreen }))) },
  dashboard: { title: 'لوحة التحكم', component: lazy(() => import('./features/Dashboard/Index').then(module => ({ default: module.DashboardScreen }))) },
  places_admin: { title: 'إدارة أماكن مشوار', component: lazy(() => import('./features/Places/Admin').then(module => ({ default: module.PlacesAdminScreen }))) },
  transit_admin: { title: 'إدارة النقل', component: lazy(() => import('./features/TransitAdmin/Index').then(module => ({ default: module.TransitAdminScreen }))) },
};
