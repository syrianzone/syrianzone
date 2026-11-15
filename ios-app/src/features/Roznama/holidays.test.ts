import { expect, test } from 'bun:test';
import { holidaysForYear, nextHoliday } from './holidays';
test('native holiday calendar preserves every original 2026 and 2027 name, date and description', async () => {
  const source = await Bun.file(new URL('../../../../resources/js/Pages/Roznama/Index.tsx', import.meta.url)).text();
  const variables = source.slice(source.indexOf('const VARIABLE_HOLIDAYS_MAP'), source.indexOf('// The six rows'));
  const routine = source.slice(source.indexOf('function holidaysForYear'), source.indexOf('export default function Index'));
  const transpiled = new Bun.Transpiler({ loader: 'ts' }).transformSync(`${variables}\n${routine}`);
  const original = new Function(`${transpiled}; return holidaysForYear;`)() as (year: number) => { nameAr: string; nameEn: string; date: Date; description: string; isNew?: boolean }[];
  for (const year of [2026, 2027, 2030]) {
    const expected = original(year).map(row => ({ nameAr: row.nameAr, nameEn: row.nameEn, day: `${year}-${String(row.date.getMonth() + 1).padStart(2, '0')}-${String(row.date.getDate()).padStart(2, '0')}`, description: row.description, isNew: row.isNew === true }));
    expect(holidaysForYear(year)).toEqual(expected);
  }
  expect(nextHoliday('2026-12-31')?.day).toBe('2027-01-01');
  expect(nextHoliday('2026-11-14')?.day).toBe('2026-12-08');
});
