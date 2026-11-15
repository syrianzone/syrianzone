import { lazy, type ComponentType } from 'react';
import type { FeatureScreenProps } from './platform/features';

export const featureScreens: Record<string, { title: string; component: ComponentType<FeatureScreenProps> }> = {
  transit_studio: { title: 'استوديو النقل', component: lazy(() => import('./features/TransitStudio/Index').then(module => ({ default: module.TransitStudioScreen }))) },
  account: { title: 'الحساب', component: lazy(() => import('./features/Account/Index').then(module => ({ default: module.AccountScreen }))) },
};
