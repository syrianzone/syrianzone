import * as Sharing from 'expo-sharing';
import { captureRef, releaseCapture } from 'react-native-view-shot';

type CaptureTarget = Parameters<typeof captureRef>[0];

interface StorySharingDependencies {
  capture: (target: CaptureTarget) => Promise<string>;
  isAvailable: () => Promise<boolean>;
  release: (uri: string) => void;
  share: (
    uri: string,
    options: { mimeType: string; UTI: string },
  ) => Promise<void>;
}

const nativeDependencies: StorySharingDependencies = {
  capture: (target) =>
    captureRef(target, { format: 'png', quality: 1, result: 'tmpfile' }),
  isAvailable: Sharing.isAvailableAsync,
  release: releaseCapture,
  share: Sharing.shareAsync,
};

export async function sharePriorityStory(
  target: CaptureTarget,
  dependencies = nativeDependencies,
): Promise<boolean> {
  if (!await dependencies.isAvailable()) {
    return false;
  }
  const uri = await dependencies.capture(target);
  try {
    await dependencies.share(uri, {
      mimeType: 'image/png',
      UTI: 'public.png',
    });
  } finally {
    dependencies.release(uri);
  }
  return true;
}

/*
PORT STATUS
  source:     resources/js/Pages/Priorities/PrioritiesApp.tsx (1596 lines)
  confidence: high
  todos:      0
  notes:      Native capture, share, and cleanup replace the browser download.
*/
