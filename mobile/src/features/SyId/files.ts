import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { apiOrigin } from '@/lib/env';
import { openSafeExternalUrl } from '@/lib/linking';

/**
 * Material filenames the deployed website links to. The Arabic filenames these
 * replaced now 404 on production, so this list is the one place they are spelled
 * out and the golden test pins it against the website's own references.
 */
export const SYID_MATERIALS = {
  flagDwg: 'syrian-flag.dwg',
  flagGuide: 'syrian-flag-guide.webp',
  flagProportionsPng: 'syrian-flag-proportions.png',
  flagProportionsSvg: 'syrian-flag-proportions.svg',
  logo: 'logo.ai.svg',
  qomra: 'qomra2.webp',
} as const;

// The identity bundle is not served from /syid-assets; the website links it on R2.
export const SYID_MATERIALS_ZIP_URL =
  'https://pub-1d51b625c56e4fd085c58a79672e1b15.r2.dev/downloads/191b8f0d278fc2ab095fb4f344e3e9b4-vGF1L1.zip';

export function syidAssetUrl(relativePath: string): string {
  if (!relativePath || relativePath.includes('..') || relativePath.startsWith('/')) {
    throw new Error('Invalid Syrian identity asset path');
  }
  return new URL(`/syid-assets/materials/${relativePath}`, `${apiOrigin}/`).toString();
}

export async function shareGeneratedFile(
  fileName: string,
  content: string,
  mimeType: string,
): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) {
    return false;
  }
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  try {
    file.write(content);
    await Sharing.shareAsync(file.uri, { mimeType });
    return true;
  } finally {
    if (file.exists) {
      file.delete();
    }
  }
}

export async function shareSyidAsset(
  relativePath: string,
  fileName: string,
  mimeType: string,
): Promise<boolean> {
  const url = syidAssetUrl(relativePath);
  if (!(await Sharing.isAvailableAsync())) {
    return openSafeExternalUrl(url);
  }
  const destination = new File(Paths.cache, fileName);
  const file = await File.downloadFileAsync(url, destination, {
    idempotent: true,
  });
  try {
    await Sharing.shareAsync(file.uri, { mimeType });
    return true;
  } finally {
    if (file.exists) {
      file.delete();
    }
  }
}
