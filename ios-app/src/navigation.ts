import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { City, Place } from './domain';

export type TabRoutes = { Home: undefined; Transit: undefined; Places: Readonly<Record<string, string>> | undefined; Saved: undefined; Settings: undefined };
export type RootRoutes = {
  Main: NavigatorScreenParams<TabRoutes> | undefined;
  TransitCity: { city: City; routeId?: string; initialView?: 'list' | 'map' };
  TransitLink: { cityId: string; routeId?: string; initialView?: 'list' | 'map' };
  Place: { id: number; snapshot?: Place };
  Feature: { section: string; params: Record<string, string> };
};
export type RootNavigation = NativeStackNavigationProp<RootRoutes>;
