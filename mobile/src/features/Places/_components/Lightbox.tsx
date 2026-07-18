import { Directory, File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import JSZip from 'jszip';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  X,
} from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';

import type { PlacePhoto } from '../_lib/types';

const MAX_DOWNLOAD_BYTES = 40 * 1024 * 1024;

function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'mishwar';
}

function extensionFor(url: string): string {
  const match = new URL(url).pathname.match(/\.(png|jpe?g|webp)$/i);
  return match?.[1]?.toLowerCase().replace('jpeg', 'jpg') ?? 'webp';
}

async function requireSharing(): Promise<void> {
  if (!await Sharing.isAvailableAsync()) {
    throw new Error('sharing_unavailable');
  }
}

async function downloadOne(photo: PlacePhoto, name: string): Promise<void> {
  await requireSharing();
  const file = new File(
    Paths.cache,
    `${safeName(name)}-${photo.id}.${extensionFor(photo.display_url)}`,
  );
  try {
    const downloaded = await File.downloadFileAsync(photo.display_url, file, {
      idempotent: true,
    });
    if (downloaded.size > MAX_DOWNLOAD_BYTES) {
      throw new Error('photo_too_large');
    }
    await Sharing.shareAsync(downloaded.uri, {
      mimeType: downloaded.type || 'image/webp',
    });
  } finally {
    if (file.exists) {
      file.delete();
    }
  }
}

async function downloadAll(
  photos: readonly PlacePhoto[],
  name: string,
  onProgress: (done: number, total: number) => void,
): Promise<number> {
  await requireSharing();
  const directory = new Directory(
    Paths.cache,
    `mishwar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  directory.create({ idempotent: true, intermediates: true });
  try {
    const zip = new JSZip();
    let failed = 0;
    let total = 0;
    for (const [index, photo] of photos.entries()) {
      const fileName = `${safeName(name)}-${index + 1}.${extensionFor(photo.display_url)}`;
      try {
        const downloaded = await File.downloadFileAsync(
          photo.display_url,
          new File(directory, fileName),
          { idempotent: true },
        );
        if (downloaded.size > MAX_DOWNLOAD_BYTES) {
          throw new Error('archive_too_large');
        }
        total += downloaded.size;
        if (total > MAX_DOWNLOAD_BYTES) {
          throw new Error('archive_too_large');
        }
        zip.file(fileName, await downloaded.bytes());
      } catch (cause) {
        if (cause instanceof Error && cause.message === 'archive_too_large') {
          throw cause;
        }
        failed += 1;
      }
      onProgress(index + 1, photos.length);
    }
    if (failed === photos.length) {
      throw new Error('archive_empty');
    }
    const bytes = await zip.generateAsync({
      compression: 'STORE',
      type: 'uint8array',
    });
    if (bytes.byteLength > MAX_DOWNLOAD_BYTES) {
      throw new Error('archive_too_large');
    }
    const archive = new File(directory, `${safeName(name)}.zip`);
    archive.create({ overwrite: true });
    archive.write(bytes);
    await Sharing.shareAsync(archive.uri, {
      mimeType: 'application/zip',
      UTI: 'public.zip-archive',
    });
    return failed;
  } finally {
    if (directory.exists) {
      directory.delete();
    }
  }
}

export function Lightbox({
  index,
  name,
  onClose,
  open,
  photos,
}: {
  index: number;
  name: string;
  onClose: () => void;
  open: boolean;
  photos: readonly PlacePhoto[];
}) {
  const { theme } = useAppTheme();
  const [current, setCurrent] = useState(
    Math.min(Math.max(index, 0), Math.max(photos.length - 1, 0)),
  );
  const [busy, setBusy] = useState<'all' | 'one' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const photo = photos[Math.min(current, photos.length - 1)];
  if (!photo) {
    return null;
  }

  const runDownload = async (mode: 'all' | 'one') => {
    setBusy(mode);
    setError(null);
    setProgress(mode === 'all' ? { done: 0, total: photos.length } : null);
    try {
      if (mode === 'all') {
        const failed = await downloadAll(
          photos,
          name,
          (done, total) => setProgress({ done, total }),
        );
        if (failed > 0) {
          setError('تعذر تحميل بعض الصور');
        }
      } else {
        await downloadOne(photo, name);
      }
    } catch {
      setError(mode === 'all' ? 'تعذر تحميل بعض الصور' : 'تعذر تحميل الصورة');
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      visible={open}
    >
      <View style={[styles.root, { backgroundColor: theme.palette.background }]}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="إغلاق معرض الصور"
            accessibilityRole="button"
            onPress={onClose}
            style={styles.close}
          >
            <X color={theme.palette.foreground} size={24} />
          </Pressable>
          <AppText color="muted">
            {current + 1} / {photos.length}
          </AppText>
        </View>
        <View style={styles.stage}>
          <Image
            accessibilityLabel={`${name} ${current + 1}`}
            contentFit="contain"
            source={photo.display_url}
            style={styles.image}
          />
          {photos.length > 1 ? (
            <>
              <Pressable
                accessibilityLabel="الصورة السابقة"
                disabled={current === 0}
                onPress={() => setCurrent((value) => Math.max(value - 1, 0))}
                style={[styles.arrow, styles.previous, current === 0 ? styles.disabled : null]}
              >
                <ChevronRight color="#ffffff" size={27} />
              </Pressable>
              <Pressable
                accessibilityLabel="الصورة التالية"
                disabled={current === photos.length - 1}
                onPress={() => setCurrent((value) => Math.min(value + 1, photos.length - 1))}
                style={[styles.arrow, styles.next, current === photos.length - 1 ? styles.disabled : null]}
              >
                <ChevronLeft color="#ffffff" size={27} />
              </Pressable>
            </>
          ) : null}
        </View>
        <View style={styles.footer}>
          {error ? <AppText color="danger">{error}</AppText> : null}
          <View style={styles.actions}>
            <AppButton
              disabled={busy !== null}
              icon={busy === 'one' ? <ActivityIndicator /> : <Download color={theme.palette.foreground} size={18} />}
              onPress={() => void runDownload('one')}
              variant="secondary"
            >
              تحميل
            </AppButton>
            <AppButton
              disabled={busy !== null}
              icon={busy === 'all' ? <ActivityIndicator /> : <Download color={theme.palette.foreground} size={18} />}
              onPress={() => void runDownload('all')}
              variant="secondary"
            >
              {busy === 'all' && progress
                ? `جارٍ التحميل ${progress.done}/${progress.total}`
                : 'تحميل الكل'}
            </AppButton>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  arrow: { alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.64)', borderRadius: 24, height: 48, justifyContent: 'center', position: 'absolute', top: '46%', width: 48 },
  close: { padding: 8 },
  disabled: { opacity: 0.3 },
  footer: { gap: 10, padding: 16 },
  header: { alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 8 },
  image: { height: '100%', width: '100%' },
  next: { left: 12 },
  previous: { right: 12 },
  root: { flex: 1 },
  stage: { flex: 1, position: 'relative' },
});

/*
PORT STATUS
  source:     resources/js/Pages/Places/_components/Lightbox.tsx (231 lines)
  confidence: high
  todos:      0
  notes:      Native full-screen viewing, RTL paging, current download, zip download, limits, and cleanup preserve the gallery flow.
*/
