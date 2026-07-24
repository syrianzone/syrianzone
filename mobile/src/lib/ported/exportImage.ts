import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

export type CapturedViewTarget = Parameters<typeof captureRef>[0];

export async function shareCapturedView(
  target: CapturedViewTarget,
  name: string,
): Promise<boolean> {
  if (!target) {
    throw new Error('لا يوجد محتوى جاهز للمشاركة.');
  }
  if (!await Sharing.isAvailableAsync()) {
    return false;
  }
  const captured = await captureRef(target, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
  });
  const source = new File(captured);
  const sharedFile = new File(Paths.cache, `${name}.png`);
  try {
    source.copy(sharedFile);
    await Sharing.shareAsync(sharedFile.uri, {
      mimeType: 'image/png',
      UTI: 'public.png',
    });
    return true;
  } finally {
    if (sharedFile.exists) {
      sharedFile.delete();
    }
    if (source.exists) {
      source.delete();
    }
  }
}

/*
PORT STATUS
  source:     resources/js/Lib/exportImage.ts (688 lines)
  confidence: high
  todos:      0
  notes:      Native capture and system sharing replace canvas export, with guaranteed cache cleanup.
*/
