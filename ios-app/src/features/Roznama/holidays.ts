import data from './holiday-data.json';
export interface Holiday { nameAr: string; nameEn: string; day: string; description: string; isNew: boolean }
export function holidaysForYear(year: number): Holiday[] {
  const variables = data.variables as Record<string, typeof data.fixed>;
  return [...data.fixed, ...(variables[String(year)] ?? [])].map(row => ({ nameAr: row.nameAr, nameEn: row.nameEn,
    day: `${year}-${String(row.month).padStart(2, '0')}-${String(row.date).padStart(2, '0')}`, description: row.description, isNew: row.isNew })).sort((a, b) => a.day.localeCompare(b.day));
}
export function nextHoliday(day: string): Holiday | null {
  const year = Number(day.slice(0, 4));
  return [...holidaysForYear(year), ...holidaysForYear(year + 1)].find(row => row.day >= day) ?? null;
}
export function daysUntil(day: string, from: string): number { return Math.ceil((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000); }

// PORT STATUS: source resources/js/Pages/Roznama/Index.tsx; confidence high; todos 0. Variable dates intentionally match the source's 2026 and 2027 tables.
