import type { HouseRow, Mode } from './types';

export type AgeFilter = '' | 'lt30' | '30s' | '40s' | '50s' | '60p';
export type AppealFilter = '' | 'appealed' | 'notAppealed';
export type ResultFilter = '' | 'winner' | 'notWinner';
export type SexFilter = '' | 'ذكر' | 'أنثى';
export type SortDirection = 'asc' | 'desc';

export interface HouseFilters {
  age: AgeFilter;
  appeal: AppealFilter;
  district: string;
  result: ResultFilter;
  search: string;
  sex: SexFilter;
}

export interface HouseSort {
  column: string;
  direction: SortDirection;
}

export interface HouseStats {
  ageGroups: Record<'lt30' | '30s' | '40s' | '50s' | '60p', number>;
  appealed: number;
  female: number;
  male: number;
  total: number;
}

export interface HousePage {
  end: number;
  items: HouseRow[];
  page: number;
  start: number;
  totalPages: number;
}

export const DEFAULT_HOUSE_FILTERS: HouseFilters = {
  age: '',
  appeal: '',
  district: 'all',
  result: '',
  search: '',
  sex: '',
};

export const DEFAULT_HOUSE_SORT: HouseSort = {
  column: 'Name',
  direction: 'asc',
};

const DISTRICT_KEY = 'Electoral District (الدائرة الانتخابية)';
const HIDDEN_COLUMNS = new Set([
  '__nameNorm',
  '__placeNorm',
  '__sexNorm',
  '__ageGroup',
  '__appealStatus',
  'أسماء جديدة',
  'الفائزين',
]);

export function normalizeHouseSearch(value: string): string {
  return value
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLocaleLowerCase('ar')
    .trim();
}

export function isHouseWinner(row: HouseRow): boolean {
  return (row['النتيجة'] || row.Result || '').trim() === 'فائز';
}

export function filterHouseRows(
  rows: readonly HouseRow[],
  mode: Mode,
  filters: HouseFilters,
): HouseRow[] {
  const search = normalizeHouseSearch(filters.search);

  return rows.filter((row) => {
    if (
      search &&
      !`${row.__nameNorm} ${row.__placeNorm}`.includes(search)
    ) {
      return false;
    }
    if (filters.sex && row.__sexNorm !== filters.sex) {
      return false;
    }
    if (filters.age && row.__ageGroup !== filters.age) {
      return false;
    }
    if (
      mode === 'voters' &&
      filters.appeal === 'appealed' &&
      row.__appealStatus !== 'مطعون'
    ) {
      return false;
    }
    if (
      mode === 'voters' &&
      filters.appeal === 'notAppealed' &&
      row.__appealStatus === 'مطعون'
    ) {
      return false;
    }
    if (
      mode === 'candidates' &&
      filters.result === 'winner' &&
      !isHouseWinner(row)
    ) {
      return false;
    }
    if (
      mode === 'candidates' &&
      filters.result === 'notWinner' &&
      isHouseWinner(row)
    ) {
      return false;
    }
    if (
      mode === 'winners' &&
      filters.district !== 'all' &&
      (row[DISTRICT_KEY] || '').trim() !== filters.district
    ) {
      return false;
    }
    return true;
  });
}

function isNumericColumn(column: string): boolean {
  return (
    column.includes('Year') ||
    column.includes('Age') ||
    column === 'سنة الميلاد'
  );
}

function numericCell(value: string): number {
  const westernDigits = value
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/\D/g, '');
  return Number(westernDigits) || 0;
}

export function sortHouseRows(
  rows: readonly HouseRow[],
  sort: HouseSort,
): HouseRow[] {
  if (!sort.column) {
    return [...rows];
  }

  return [...rows].sort((left, right) => {
    const leftValue = left[sort.column];
    const rightValue = right[sort.column];
    if (!leftValue && !rightValue) {
      return 0;
    }
    if (!leftValue) {
      return 1;
    }
    if (!rightValue) {
      return -1;
    }

    const result = isNumericColumn(sort.column)
      ? numericCell(leftValue) - numericCell(rightValue)
      : leftValue.localeCompare(rightValue, 'ar');
    return sort.direction === 'asc' ? result : -result;
  });
}

export function nextHouseSort(current: HouseSort, column: string): HouseSort {
  return current.column === column
    ? {
        column,
        direction: current.direction === 'asc' ? 'desc' : 'asc',
      }
    : { column, direction: 'asc' };
}

export function deriveHouseStats(rows: readonly HouseRow[]): HouseStats {
  const stats: HouseStats = {
    ageGroups: { '30s': 0, '40s': 0, '50s': 0, '60p': 0, lt30: 0 },
    appealed: 0,
    female: 0,
    male: 0,
    total: rows.length,
  };

  for (const row of rows) {
    if (row.__sexNorm === 'ذكر') {
      stats.male += 1;
    }
    if (row.__sexNorm === 'أنثى') {
      stats.female += 1;
    }
    if (row.__appealStatus === 'مطعون') {
      stats.appealed += 1;
    }
    if (row.__ageGroup in stats.ageGroups) {
      stats.ageGroups[row.__ageGroup as keyof HouseStats['ageGroups']] += 1;
    }
  }

  return stats;
}

export function housePercentage(value: number, total: number): string {
  return `${(total > 0 ? (value / total) * 100 : 0).toFixed(1)}%`;
}

export function deriveHouseDistricts(
  rows: readonly HouseRow[],
  mode: Mode,
): string[] {
  if (mode !== 'winners') {
    return [];
  }
  return [...new Set(rows.map((row) => row[DISTRICT_KEY]?.trim()).filter(Boolean))]
    .filter((district): district is string => Boolean(district))
    .sort((left, right) => left.localeCompare(right, 'ar'));
}

export function displayHouseColumns(
  headers: readonly string[],
  rows: readonly HouseRow[],
): string[] {
  return headers.filter(
    (header) =>
      !HIDDEN_COLUMNS.has(header) &&
      rows.some((row) => Boolean(row[header]?.trim())),
  );
}

export function extractNewNames(
  headers: readonly string[],
  rows: readonly HouseRow[],
  mode: Mode,
): string[] {
  if (mode !== 'voters') {
    return [];
  }
  const key = headers.find((header) => header.includes('أسماء جديدة'));
  if (!key) {
    return [];
  }
  return rows.flatMap((row) =>
    (row[key] || '')
      .split(/[,،]+/)
      .map((name) => name.trim())
      .filter(Boolean),
  );
}

export function paginateHouseRows(
  rows: readonly HouseRow[],
  requestedPage: number,
  requestedPageSize: number,
): HousePage {
  const pageSize = Math.max(1, Math.floor(requestedPageSize));
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(
    totalPages - 1,
    Math.max(0, Math.floor(requestedPage)),
  );
  const start = page * pageSize;
  const end = Math.min(rows.length, start + pageSize);

  return {
    end,
    items: rows.slice(start, end),
    page,
    start,
    totalPages,
  };
}

/*
PORT STATUS
  source:     resources/js/Pages/House/HouseClient.tsx (533 lines)
  confidence: high
  todos:      0
  notes:      Pure source filtering, sorting, statistics, and new-name derivation support native rendering.
*/
