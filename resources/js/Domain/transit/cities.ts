import { useQuery } from '@tanstack/react-query';
import { transitCities } from './api';
import type { TransitCity } from './types';

/**
 * The live city list — `GET /api/v1/cities` — for the surfaces that are not the
 * map: the search palette's city group and the 404 grid.
 *
 * The list is the table's, so the "N خط" badge and the card's link follow what
 * the server serves instead of a checked-in copy of the cities. `enabled` lets a
 * closed palette ask for nothing; the shared query client caches the answer for
 * every surface that opens afterwards.
 */
export function useTransitCities(enabled = true) {
  return useQuery<TransitCity[]>({
    queryKey: ['transit', 'cities'],
    queryFn: ({ signal }) => transitCities(signal),
    enabled,
  });
}
