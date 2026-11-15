import { createContext, useContext, type ReactNode } from 'react';

export interface FeatureScreenProps { readonly params: Readonly<Record<string, string>> }
export interface FeatureNavigation { open(section: string, params?: Record<string, string>): void; back(): void }
const Context = createContext<FeatureNavigation | null>(null);
export function FeatureNavigationProvider({ value, children }: { value: FeatureNavigation; children: ReactNode }): React.JSX.Element {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useFeatureNavigation(): FeatureNavigation {
  const value = useContext(Context);
  if (!value) throw new Error('Feature navigation is unavailable');
  return value;
}
