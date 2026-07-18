import { useQuery } from '@tanstack/react-query';

import { QueryState } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';

import { CityGrid } from './_components/landing/CityGrid';
import { Hero } from './_components/landing/Hero';
import { TransitHeader } from './_components/layout/Header';
import citiesFallback from './_data/cities';
import type { City } from './_types';
import { getCities } from './api';

export default function TransitScreen() {
  const cities = useQuery({
    queryFn: getCities,
    queryKey: ['transit-cities'],
    staleTime: 60 * 60 * 1000,
  });
  const data = (cities.data ?? citiesFallback) as readonly City[];
  return (
    <Screen trailing={<TransitHeader />}>
      <Hero />
      {cities.isError && data.length === 0 ? (
        <QueryState onRetry={() => void cities.refetch()} type="error" />
      ) : (
        <CityGrid cities={data} />
      )}
    </Screen>
  );
}

/*
PORT STATUS
  source:     resources/js/Pages/Transit/Index.tsx (34 lines)
  confidence: high
  todos:      0
  notes:      The Expo route layout owns providers while the screen keeps live data and its offline fallback.
*/
