import {
  isProvinceCollection,
  type ProvinceCollection,
} from '@/features/SyId/model';

import { loadGeoJsonAsset } from './asset';

let provincePromise: Promise<ProvinceCollection> | null = null;

async function readProvinceData(): Promise<ProvinceCollection> {
  return loadGeoJsonAsset(
    // Metro needs a static CommonJS asset reference to include this file.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../../../assets/data/population/syria_provinces.geojson'),
    isProvinceCollection,
  );
}

export function loadBundledProvinceData(): Promise<ProvinceCollection> {
  provincePromise ??= readProvinceData().catch((error: unknown) => {
    provincePromise = null;
    throw error;
  });
  return provincePromise;
}
