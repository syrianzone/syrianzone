import type { HouseRow } from './types';
import {
  DEFAULT_HOUSE_FILTERS,
  deriveHouseDistricts,
  deriveHouseStats,
  displayHouseColumns,
  extractNewNames,
  filterHouseRows,
  housePercentage,
  nextHouseSort,
  sortHouseRows,
} from './model';

const rows: HouseRow[] = [
  {
    Age: '42',
    Name: 'أَحمد',
    Place: 'دمشق',
    Result: 'فائز',
    Sex: 'انثي',
    'أسماء جديدة': 'خالد، رنا',
    'Electoral District (الدائرة الانتخابية)': 'دمشق',
    'حالة الطعن': 'مطعون',
    المهنة: 'طبيب',
    فارغ: '',
    __ageGroup: '40s',
    __appealStatus: 'مطعون',
    __nameNorm: 'احمد',
    __placeNorm: 'دمشق',
    __sexNorm: 'أنثى',
  },
  {
    Age: '56',
    Name: 'سامر',
    Place: 'حلب',
    Result: 'خاسر',
    Sex: 'ذكر',
    'أسماء جديدة': 'نور, ليث',
    'Electoral District (الدائرة الانتخابية)': 'حلب',
    'حالة الطعن': 'سليم',
    المهنة: 'مهندس',
    فارغ: '',
    __ageGroup: '50s',
    __appealStatus: 'سليم',
    __nameNorm: 'سامر',
    __placeNorm: 'حلب',
    __sexNorm: 'ذكر',
  },
  {
    Age: '27',
    Name: 'ليلى',
    Place: 'ريف دمشق',
    Result: '',
    Sex: 'أنثى',
    'أسماء جديدة': '',
    'Electoral District (الدائرة الانتخابية)': 'دمشق',
    'حالة الطعن': '',
    المهنة: '',
    فارغ: '',
    __ageGroup: 'lt30',
    __appealStatus: '',
    __nameNorm: 'ليلي',
    __placeNorm: 'ريف دمشق',
    __sexNorm: 'أنثى',
  },
];

describe('House source characterization', () => {
  test('keeps common and mode-specific filters', () => {
    expect(
      filterHouseRows(rows, 'voters', {
        ...DEFAULT_HOUSE_FILTERS,
        appeal: 'appealed',
        search: 'أحمد',
        sex: 'أنثى',
      }),
    ).toEqual([rows[0]]);
    expect(
      filterHouseRows(rows, 'candidates', {
        ...DEFAULT_HOUSE_FILTERS,
        result: 'notWinner',
      }),
    ).toEqual([rows[1], rows[2]]);
    expect(
      filterHouseRows(rows, 'winners', {
        ...DEFAULT_HOUSE_FILTERS,
        age: 'lt30',
        district: 'دمشق',
      }),
    ).toEqual([rows[2]]);
  });

  test('sorts dynamic text and numeric columns in either direction', () => {
    expect(sortHouseRows(rows, { column: 'Age', direction: 'asc' })).toEqual([
      rows[2],
      rows[0],
      rows[1],
    ]);
    expect(
      sortHouseRows(rows, { column: 'Name', direction: 'desc' }).map(
        (row) => row.Name,
      ),
    ).toEqual(['ليلى', 'سامر', 'أَحمد']);
    expect(nextHouseSort({ column: 'Age', direction: 'asc' }, 'Age')).toEqual({
      column: 'Age',
      direction: 'desc',
    });
    expect(nextHouseSort({ column: 'Age', direction: 'desc' }, 'Name')).toEqual({
      column: 'Name',
      direction: 'asc',
    });
  });

  test('derives source statistics, percentages, districts, and chart values', () => {
    expect(deriveHouseStats(rows)).toEqual({
      ageGroups: { '30s': 0, '40s': 1, '50s': 1, '60p': 0, lt30: 1 },
      appealed: 1,
      female: 2,
      male: 1,
      total: 3,
    });
    expect(housePercentage(2, 3)).toBe('66.7%');
    expect(housePercentage(0, 0)).toBe('0.0%');
    expect(deriveHouseDistricts(rows, 'winners')).toEqual(['حلب', 'دمشق']);
    expect(deriveHouseDistricts(rows, 'voters')).toEqual([]);
  });

  test('keeps every populated source column and separates new names', () => {
    const headers = [
      'Name',
      'Age',
      'المهنة',
      'فارغ',
      'أسماء جديدة',
      '__nameNorm',
      'الفائزين',
    ];

    expect(displayHouseColumns(headers, rows)).toEqual([
      'Name',
      'Age',
      'المهنة',
    ]);
    expect(extractNewNames(headers, rows, 'voters')).toEqual([
      'خالد',
      'رنا',
      'نور',
      'ليث',
    ]);
    expect(extractNewNames(headers, rows, 'winners')).toEqual([]);
  });
});
