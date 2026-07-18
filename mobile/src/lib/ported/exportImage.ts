import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

export async function shareCapturedView(ref: RefObject<View | null>, name: string): Promise<void> {
  if (!ref.current) {
    throw new Error('لا يوجد محتوى جاهز للمشاركة.');
  }
  const captured = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
  const source = new File(captured);
  const target = new File(Paths.cache, `${name}.png`);
  try {
    source.copy(target);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(target.uri, { mimeType: 'image/png' });
    }
  } finally {
    if (target.exists) {
      target.delete();
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
