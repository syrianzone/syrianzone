import * as Sharing from 'expo-sharing';
import { captureRef, releaseCapture } from 'react-native-view-shot';

export type CompassRasterFormat = 'jpg' | 'png';
type CaptureTarget = Parameters<typeof captureRef>[0];

interface RasterSharingDependencies {
  capture: (
    target: CaptureTarget,
    format: CompassRasterFormat,
  ) => Promise<string>;
  isAvailable: () => Promise<boolean>;
  release: (uri: string) => void;
  share: (
    uri: string,
    options: { mimeType: string; UTI: string },
  ) => Promise<void>;
}

const nativeDependencies: RasterSharingDependencies = {
  capture: (target, format) =>
    captureRef(target, {
      format,
      quality: format === 'jpg' ? 0.9 : 1,
      result: 'tmpfile',
    }),
  isAvailable: Sharing.isAvailableAsync,
  release: releaseCapture,
  share: Sharing.shareAsync,
};

export async function shareCompassRaster(
  target: CaptureTarget,
  format: CompassRasterFormat,
  dependencies = nativeDependencies,
): Promise<boolean> {
  if (!await dependencies.isAvailable()) {
    return false;
  }
  const uri = await dependencies.capture(target, format);
  try {
    await dependencies.share(
      uri,
      format === 'jpg'
        ? { mimeType: 'image/jpeg', UTI: 'public.jpeg' }
        : { mimeType: 'image/png', UTI: 'public.png' },
    );
  } finally {
    dependencies.release(uri);
  }
  return true;
}

/*
PORT STATUS
  source:     resources/js/Pages/Alignment/CompassClient.tsx (504 lines)
  confidence: high
  todos:      0
  notes:      Native capture preserves PNG and JPG output with guaranteed cleanup.
*/
