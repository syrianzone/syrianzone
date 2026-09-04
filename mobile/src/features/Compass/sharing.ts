import * as Sharing from 'expo-sharing';
import { captureRef, releaseCapture } from 'react-native-view-shot';

type CaptureTarget = Parameters<typeof captureRef>[0];

interface ResultSharingDependencies {
  capture: (target: CaptureTarget) => Promise<string>;
  isAvailable: () => Promise<boolean>;
  release: (uri: string) => void;
  share: (
    uri: string,
    options: { mimeType: string; UTI: string },
  ) => Promise<void>;
}

const nativeDependencies: ResultSharingDependencies = {
  // The web build downloads a JPG at 0.9 quality; keep the same output here.
  capture: (target) =>
    captureRef(target, { format: 'jpg', quality: 0.9, result: 'tmpfile' }),
  isAvailable: Sharing.isAvailableAsync,
  release: releaseCapture,
  share: Sharing.shareAsync,
};

export async function shareCompassResultCard(
  target: CaptureTarget,
  dependencies = nativeDependencies,
): Promise<boolean> {
  if (!await dependencies.isAvailable()) {
    return false;
  }
  const uri = await dependencies.capture(target);
  try {
    await dependencies.share(uri, {
      mimeType: 'image/jpeg',
      UTI: 'public.jpeg',
    });
  } finally {
    dependencies.release(uri);
  }
  return true;
}

/*
PORT STATUS
  source:     resources/js/Pages/Compass/CompassApp.tsx (372 lines, image export)
  confidence: high
  todos:      0
  notes:      Native capture and the system share sheet replace the html2canvas
              JPG download and its size modal.
*/
