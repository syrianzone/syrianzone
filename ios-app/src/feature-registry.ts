import { lazy, type ComponentType } from 'react';
import type { FeatureScreenProps } from './platform/features';

export const featureScreens: Record<string, { title: string; component: ComponentType<FeatureScreenProps> }> = {
  crossings: { title: 'المعابر', component: lazy(() => import('./features/Crossings/Index').then(module => ({ default: module.CrossingsScreen }))) },
  compass: { title: 'بوصلة سوريا', component: lazy(() => import('./features/Compass/Index').then(module => ({ default: module.CompassScreen }))) },
  tierlist: { title: 'تقييم الأداء', component: lazy(() => import('./features/TierList/Index').then(module => ({ default: module.TierListScreen }))) },
  muslim: { title: 'الركن الإسلامي', component: lazy(() => import('./features/Muslim/Index').then(module => ({ default: module.MuslimScreen }))) },
  muslim_prayer: { title: 'مواقيت الصلاة', component: lazy(() => import('./features/Muslim/Prayer/Index').then(module => ({ default: module.PrayerScreen }))) },
  muslim_quran: { title: 'قارئ القرآن', component: lazy(() => import('./features/Muslim/Quran/Index').then(module => ({ default: module.QuranScreen }))) },
  muslim_radio: { title: 'إذاعة القرآن', component: lazy(() => import('./features/Muslim/Radio/Index').then(module => ({ default: module.RadioScreen }))) },
  roznama: { title: 'الروزنامة', component: lazy(() => import('./features/Roznama/Index').then(module => ({ default: module.RoznamaScreen }))) },
  hotels: { title: 'الفنادق', component: lazy(() => import('./features/Hotels/Index').then(module => ({ default: module.HotelsScreen }))) },
  hotel: { title: 'تفاصيل الفندق', component: lazy(() => import('./features/Hotels/Index').then(module => ({ default: module.HotelScreen }))) },
  guides: { title: 'المرشدون المحليون', component: lazy(() => import('./features/Guides/Index').then(module => ({ default: module.GuidesScreen }))) },
  board: { title: 'لوح', component: lazy(() => import('./features/Board/Index').then(module => ({ default: module.BoardScreen }))) },
  atlas: { title: 'أطلس سوريا', component: lazy(() => import('./features/Population/Index').then(module => ({ default: module.PopulationScreen }))) },
  transit_studio: { title: 'استوديو النقل', component: lazy(() => import('./features/TransitStudio/Index').then(module => ({ default: module.TransitStudioScreen }))) },
  account: { title: 'الحساب', component: lazy(() => import('./features/Account/Index').then(module => ({ default: module.AccountScreen }))) },
  dashboard: { title: 'لوحة التحكم', component: lazy(() => import('./features/Dashboard/Index').then(module => ({ default: module.DashboardScreen }))) },
  places_admin: { title: 'إدارة أماكن مشوار', component: lazy(() => import('./features/Places/Admin').then(module => ({ default: module.PlacesAdminScreen }))) },
  transit_admin: { title: 'إدارة النقل', component: lazy(() => import('./features/TransitAdmin/Index').then(module => ({ default: module.TransitAdminScreen }))) },
};
