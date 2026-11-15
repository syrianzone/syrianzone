import type { PromiseCardData, PromiseCounter } from '../../../../resources/js/Domain/promises/types';
import type { FilterOptions, FilterValue, PromiseStateFilter } from './model';
export interface Facet { key: string; label: string; options: readonly { value: string; label: string }[]; selectionMode?: 'single' | 'multiple' }
interface SourceFilters {
  SORT_OPTIONS: readonly { value: string; label: string }[];
  promiseFilterFacets(options: FilterOptions): Facet[];
  readPromiseFilters(url: string, facets: readonly Facet[]): FilterValue;
  promiseListUrl(value: FilterValue): string;
  promiseReturnUrl(url: string): string;
  canReturnToPromiseList(visit: unknown, detailUrl: string): boolean;
  matchesState(card: PromiseCardData, state: string, dueSoonDays: number): boolean;
  activeScoreboardState(value: FilterValue): string | null | undefined;
  selectScoreboardState(value: FilterValue, state: string | null): FilterValue;
  narrowFromChart(value: FilterValue, key: 'state' | 'sector' | 'speaker', id: string): FilterValue | null;
  filterPromises(cards: PromiseCardData[], value: FilterValue): PromiseCardData[];
  visiblePromises(base: PromiseCardData[], value: FilterValue, dueSoonDays: number): PromiseCardData[];
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const filters = require('../../../../resources/js/Pages/Promises/_lib/filters') as SourceFilters;
interface SourceFormat { formatDate(value: string | null | undefined): string; daysPhrase(value: number): string; hoursPhrase(value: number): string; minutesPhrase(value: number): string; dayWord(value: number): string; calendarCounterCaption(counter: PromiseCounter, dates: Partial<Pick<PromiseCardData, 'deadlineDate' | 'statementDate'>>): string | null }
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const format = require('../../../../resources/js/Domain/promises/format') as SourceFormat;
export type { PromiseStateFilter };
// PORT NOTE: Narrow facades execute unchanged browser-independent source filter/date helpers while native views own controls and persistence.
// PORT STATUS: source resources/js/Pages/Promises/_lib/filters.ts and Domain/promises/format.ts; confidence high; todos 0.

export const { activeScoreboardState, canReturnToPromiseList, filterPromises, matchesState, narrowFromChart, promiseFilterFacets, promiseListUrl, promiseReturnUrl, readPromiseFilters, selectScoreboardState, visiblePromises } = filters;
