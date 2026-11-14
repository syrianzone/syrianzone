import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { City, Place } from './domain';

export type TabRoutes = { Home: undefined; Transit: undefined; Places: undefined; Saved: undefined; Settings: undefined };
export type RootRoutes = {
  Main: NavigatorScreenParams<TabRoutes> | undefined;
  TransitCity: { city: City };
  Place: { id: number; snapshot?: Place };
};
export type RootNavigation = NativeStackNavigationProp<RootRoutes>;
