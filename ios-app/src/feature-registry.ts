import { lazy, type ComponentType } from 'react';
import type { FeatureScreenProps } from './platform/features';

export const featureScreens: Record<string, { title: string; component: ComponentType<FeatureScreenProps> }> = {
  guides: { title: 'المرشدون المحليون', component: lazy(() => import('./features/Guides/Index').then(module => ({ default: module.GuidesScreen }))) },
  transit_studio: { title: 'استوديو النقل', component: lazy(() => import('./features/TransitStudio/Index').then(module => ({ default: module.TransitStudioScreen }))) },
  account: { title: 'الحساب', component: lazy(() => import('./features/Account/Index').then(module => ({ default: module.AccountScreen }))) },
  transit_admin: { title: 'إدارة النقل', component: lazy(() => import('./features/TransitAdmin/Index').then(module => ({ default: module.TransitAdminScreen }))) },
};
