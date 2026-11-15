/* eslint-disable @typescript-eslint/no-require-imports -- Typed facade executes the unchanged browser-independent source. */
import type { DataType, DataTypeConfig } from '../../../../resources/js/Pages/Population/constants/data-config';

export type { DataType };
interface Governorate { id: string; nameAr: string; nameEn: string; datasetNameEn: string; pcode: string; sortOrder: number }
// Reuse the source's pure classifiers and geographical aliases without its DOM map.
const config: { DATA_TYPE_CONFIG: Record<DataType, DataTypeConfig> } = require('../../../../resources/js/Pages/Population/constants/data-config');
const colors: {
  getColor(value: number, type: DataType, thresholds: readonly number[]): string;
  getTemperatureColor(value: number): string;
  buildLegend(type: DataType, thresholds: readonly number[]): { label: string; color: string }[];
} = require('../../../../resources/js/Pages/Population/utils/color-calculator');
const geography: {
  GOVERNORATES: readonly Governorate[];
  governorateByAnyName(name: string): Governorate | undefined;
} = require('../../../../resources/js/Domain/geography/governorates');

export const DATA_TYPE_CONFIG = config.DATA_TYPE_CONFIG;
export const getColor = colors.getColor;
export const getTemperatureColor = colors.getTemperatureColor;
export const buildLegend = (type: DataType, thresholds: readonly number[]) => colors.buildLegend(type, thresholds).map(entry => ({ ...entry, label: entry.label.replace(/[\u2013\u2014]/g, ' - ') }));
export const governorateByAnyName = geography.governorateByAnyName;
export const GOVERNORATES = [...geography.GOVERNORATES].sort((a, b) => a.sortOrder - b.sortOrder);
// PORT STATUS: source Population constants/data-config.ts, utils/color-calculator.ts and Domain/geography/governorates.ts; confidence high; todos 0.
