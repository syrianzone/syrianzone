import * as Linking from 'expo-linking';

const allowedSchemes = new Set(['http:', 'https:', 'mailto:', 'tel:']);

export function isSafeExternalUrl(value: string): boolean {
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    return false;
  }

  try {
    const url = new URL(value);
    return allowedSchemes.has(url.protocol);
  } catch {
    return false;
  }
}

export async function openSafeExternalUrl(value: string): Promise<boolean> {
  if (!isSafeExternalUrl(value)) {
    return false;
  }

  const supported = await Linking.canOpenURL(value);
  if (!supported) {
    return false;
  }

  await Linking.openURL(value);
  return true;
}
