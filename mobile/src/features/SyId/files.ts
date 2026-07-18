import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { apiOrigin } from '@/lib/env';
import { openSafeExternalUrl } from '@/lib/linking';

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
