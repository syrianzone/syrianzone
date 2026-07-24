import { placesApi } from './api';
import type { GridPhoto, Guide, GuidesSort, Paginated } from './types';

export const discovery = {
  guides: (sort: GuidesSort): Promise<{ guides: Guide[]; sort: GuidesSort }> =>
    placesApi.guides(sort),
  gridPhotos: (page: number, userId?: number): Promise<Paginated<GridPhoto>> =>
    placesApi.gridPhotos(page, userId),
};

/*
PORT STATUS
  source:     resources/js/Pages/Places/_lib/discovery.ts (37 lines)
  confidence: high
  todos:      0
  notes:      Guide and guide-filtered photo reads share the validated native client while retaining the source module boundary.
*/
