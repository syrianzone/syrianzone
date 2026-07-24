import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import JSZip from 'jszip';

import type { PollCandidate } from '@/lib/api/polls';
import { apiOrigin } from '@/lib/env';
import {
  shareCapturedView,
  type CapturedViewTarget,
} from '@/lib/ported/exportImage';

const MAX_ARCHIVE_CANDIDATES = 20;
const MAX_ARCHIVE_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ARCHIVE_TOTAL_BYTES = 40 * 1024 * 1024;
type CaptureTarget = CapturedViewTarget;

interface CapturedImageDependencies {
  capture: (target: CaptureTarget) => Promise<string>;
  isAvailable: () => Promise<boolean>;
  release?: (uri: string) => void;
  share: (
    uri: string,
    options: { mimeType: string; UTI: string },
  ) => Promise<void>;
}

interface ArchiveFile {
  bytes: Uint8Array;
  name: string;
}

export interface CandidateArchiveDependencies {
  archive: (files: readonly ArchiveFile[]) => Promise<Uint8Array>;
  cleanup: () => Promise<void>;
  download: (url: string, index: number) => Promise<ArchiveFile>;
  shareArchive: (bytes: Uint8Array, name: string) => Promise<void>;
}

export function resolvePollImageUrl(
  value: null | string | undefined,
): string | null {
  const candidate = value?.trim();
  if (!candidate || candidate.startsWith('//')) {
    return null;
  }
  try {
    const url = new URL(candidate, `${apiOrigin}/`);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export async function shareCapturedPollImage(
  target: CaptureTarget,
  dependencies?: CapturedImageDependencies,
): Promise<boolean> {
  if (!dependencies) {
    return shareCapturedView(target, 'tier-board');
  }
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
    dependencies.release?.(uri);
  }
  return true;
}

function extensionFor(url: string): string {
  const match = new URL(url).pathname.match(/\.(png|jpe?g|webp)$/i);
  return match?.[1]?.toLowerCase().replace('jpeg', 'jpg') ?? 'jpg';
}

export function createNativeArchiveDependencies(): CandidateArchiveDependencies {
  const directory = new Directory(
    Paths.cache,
    `poll-candidates-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  const ensureDirectory = () => {
    if (!directory.exists) {
      directory.create({ idempotent: true, intermediates: true });
    }
  };
  return {
    archive: async (files) => {
      const zip = new JSZip();
      for (const file of files) {
        zip.file(file.name, file.bytes);
      }
      return zip.generateAsync({
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
        type: 'uint8array',
      });
    },
    cleanup: async () => {
      if (directory.exists) {
        directory.delete();
      }
    },
    download: async (url, index) => {
      ensureDirectory();
      const name = `${index + 1}.${extensionFor(url)}`;
      const destination = new File(directory, name);
      const file = await File.downloadFileAsync(url, destination, {
        idempotent: true,
      });
      return { bytes: await file.bytes(), name };
    },
    shareArchive: async (bytes, name) => {
      if (!await Sharing.isAvailableAsync()) {
        throw new Error('sharing_unavailable');
      }
      ensureDirectory();
      const archive = new File(directory, name);
      archive.create({ overwrite: true });
      archive.write(bytes);
      await Sharing.shareAsync(archive.uri, {
        mimeType: 'application/zip',
        UTI: 'public.zip-archive',
      });
    },
  };
}

export async function createAndShareCandidateArchive(
  candidates: readonly PollCandidate[],
  dependencies = createNativeArchiveDependencies(),
): Promise<void> {
  const urls = candidates.flatMap((candidate) => {
    const url = resolvePollImageUrl(candidate.imageUrl);
    return url ? [url] : [];
  });
  if (urls.length === 0) {
    throw new Error('archive_empty');
  }
  if (urls.length > MAX_ARCHIVE_CANDIDATES) {
    throw new Error('archive_limit');
  }

  try {
    const files: ArchiveFile[] = [];
    let totalBytes = 0;
    for (const [index, url] of urls.entries()) {
      const file = await dependencies.download(url, index);
      if (file.bytes.byteLength > MAX_ARCHIVE_FILE_BYTES) {
        throw new Error('archive_file_too_large');
      }
      totalBytes += file.bytes.byteLength;
      if (totalBytes > MAX_ARCHIVE_TOTAL_BYTES) {
        throw new Error('archive_too_large');
      }
      files.push(file);
    }
    const archive = await dependencies.archive(files);
    if (archive.byteLength > MAX_ARCHIVE_TOTAL_BYTES) {
      throw new Error('archive_too_large');
    }
    await dependencies.shareArchive(archive, 'syrianzone-candidates.zip');
  } finally {
    await dependencies.cleanup();
  }
}
