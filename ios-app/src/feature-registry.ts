import { lazy, type ComponentType } from 'react';
import type { FeatureScreenProps } from './platform/features';

export const featureScreens: Record<string, { title: string; component: ComponentType<FeatureScreenProps> }> = {
  account: { title: 'الحساب', component: lazy(() => import('./features/Account/Index').then(module => ({ default: module.AccountScreen }))) },
};
