import { placesApi } from './api';
import type { GridPhoto, Guide, GuidesSort, Paginated } from './types';

export const discovery = {
  guides: (sort: GuidesSort): Promise<{ guides: Guide[]; sort: GuidesSort }> =>
    placesApi.guides(sort),
  gridPhotos: (page: number): Promise<Paginated<GridPhoto>> =>
    placesApi.gridPhotos(page),
};

/*
PORT STATUS
  source:     resources/js/Pages/Places/_lib/discovery.ts (35 lines)
  confidence: high
  todos:      0
  notes:      Discovery reads share the validated native client while retaining the source module boundary.
*/
