import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import type { GeoJsonObject } from 'geojson';

export type GeoJsonValidator<T extends GeoJsonObject> = (
  value: unknown,
) => value is T;

const INVALID_ASSET_MESSAGE = 'Bundled map data is unavailable';

export function parseGeoJsonAsset<T extends GeoJsonObject>(
  contents: string,
  validate: GeoJsonValidator<T>,
): T {
  try {
    const value: unknown = JSON.parse(contents);
    if (validate(value)) {
      return value;
    }
  } catch {
    // The public error stays stable and never exposes parser details.
  }
  throw new Error(INVALID_ASSET_MESSAGE);
}

export async function loadGeoJsonAsset<T extends GeoJsonObject>(
  moduleId: number,
  validate: GeoJsonValidator<T>,
): Promise<T> {
  try {
    const asset = Asset.fromModule(moduleId);
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    return parseGeoJsonAsset(await new File(uri).text(), validate);
  } catch {
    throw new Error(INVALID_ASSET_MESSAGE);
  }
}
