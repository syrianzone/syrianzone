import { normalizeArabic } from '@/Lib/arabic';
import raw from '../../../data/governorates.json';

/**
 * The fourteen Syrian governorates.
 *
 * The table itself is `resources/data/governorates.json` (documented in
 * `resources/data/README.md`) and PHP reads the same file through
 * `App\Support\Facts`, so a coordinate, a spelling or a pcode is edited once.
 * This module is the typed projection plus the lookups the app needs.
 */
export interface Governorate {
  /** Endpoint-facing slug (`?governorate=damascus`). */
  id: string;
  nameAr: string;
  nameEn: string;
  /** The English spelling the population atlas' external datasets key on. */
  datasetNameEn: string;
  pcode: string;
  lat: number;
  lng: number;
  /** Position in the promise forms' governorate select. */
  optionOrder: number;
  /** Position in the prayer picker and the board's governorate widgets. */
  pickerOrder: number;
  /** Position in the population atlas' city lists. */
  sortOrder: number;
  /** F3alia's province enum for the events API. */
  f3aliaProvince: string;
  /** Basename of the outline SVG under `Pages/Transit/_data/governorates/`. */
  transitSvg: string;
  aliases: string[];
}

function toGovernorate(row: (typeof raw)[number]): Governorate {
  return {
    id: row.id,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    datasetNameEn: row.dataset_name_en,
    pcode: row.pcode,
    lat: row.lat,
    lng: row.lng,
    optionOrder: row.option_order,
    pickerOrder: row.picker_order,
    sortOrder: row.sort_order,
    f3aliaProvince: row.f3alia_province,
    transitSvg: row.transit_svg,
    aliases: row.aliases,
  };
}

/** In the order the home, Roznama and settings surfaces have always shown. */
export const GOVERNORATES: Governorate[] = raw.map(toGovernorate);

export const GOVERNORATES_BY_ID: Record<string, Governorate> = Object.fromEntries(
  GOVERNORATES.map((governorate) => [governorate.id, governorate]),
);

/** A governorate spelling's comparison key: the shared Arabic fold (`Lib/arabic.ts`, the same table as `ArabicSearch::fold()` in PHP). */
export function normalizeGovernorateName(name: string): string {
  return normalizeArabic(name);
}

/** The population atlas normalises arbitrary province names with it. */
export const normalizeForMatching = normalizeGovernorateName;

const GOVERNORATE_BY_ALIAS: Record<string, Governorate> = (() => {
  const index: Record<string, Governorate> = {};
  for (const governorate of GOVERNORATES) {
    const spellings = [
      governorate.id,
      governorate.nameAr,
      governorate.nameEn,
      governorate.datasetNameEn,
      governorate.pcode,
      ...governorate.aliases,
    ];
    for (const spelling of spellings) {
      const key = normalizeGovernorateName(spelling);
      index[key] ??= governorate;
    }
  }
  return index;
})();

/** Any spelling — id, pcode, Arabic, English or a transliteration variant. */
export function governorateByAnyName(name: string): Governorate | undefined {
  return GOVERNORATE_BY_ALIAS[normalizeGovernorateName(name)];
}

export function governorateById(id: string): Governorate | undefined {
  return GOVERNORATES_BY_ID[id];
}

/** The Arabic name for any spelling, or the input unchanged when unknown. */
export function getCanonicalGovernorateName(name: string): string {
  return governorateByAnyName(name)?.nameAr ?? name;
}

/** The Arabic name for any spelling; empty for an empty input. */
export function getGovernorateNameAr(name: string): string {
  if (!name) return '';
  return getCanonicalGovernorateName(name);
}

/** The English spelling an external dataset keys a governorate on. */
export function getGovernorateDatasetNameEn(name: string): string {
  return governorateByAnyName(name)?.datasetNameEn ?? name;
}

export function getGovernoratePcode(name: string): string | undefined {
  return governorateByAnyName(name)?.pcode;
}

/** The F3alia province enum for a governorate id, or null when unknown. */
export function f3aliaProvinceFor(governorateId: string): string | null {
  return governorateById(governorateId)?.f3aliaProvince ?? null;
}

/** The Arabic name of a F3alia province enum value (fallback: undefined). */
export function governorateNameForF3aliaProvince(province: string): string | undefined {
  return GOVERNORATES.find((governorate) => governorate.f3aliaProvince === province)?.nameAr;
}

/** The prayer picker's order, which the board's governorate widgets share. */
export function governoratesByPickerOrder(): Governorate[] {
  return [...GOVERNORATES].sort((a, b) => a.pickerOrder - b.pickerOrder);
}

/** Picker-order `{ value, label }` pairs for a `<Select>`. */
export function governorateOptions(): { value: string; label: string }[] {
  return governoratesByPickerOrder().map((governorate) => ({
    value: governorate.id,
    label: governorate.nameAr,
  }));
}

/** The population atlas' display order. */
export function sortCitiesByOrder(cities: [string, number][]): [string, number][] {
  const order = (name: string): number => governorateByAnyName(name)?.sortOrder ?? 999;

  return cities.sort((a, b) => order(a[0]) - order(b[0]));
}
