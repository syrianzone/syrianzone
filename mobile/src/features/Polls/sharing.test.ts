import type { PollCandidate } from '@/lib/api/polls';
import { shareCapturedView } from '@/lib/ported/exportImage';

import {
  createAndShareCandidateArchive,
  resolvePollImageUrl,
  shareCapturedPollImage,
} from './sharing';

jest.mock('@/lib/ported/exportImage', () => ({
  shareCapturedView: jest.fn(),
}));

function candidate(id: string, imageUrl: string | null): PollCandidate {
  return {
    archiveReason: null,
    category: 'jolani',
    groupId: 'jolani',
    id,
    imageUrl,
    name: id,
    status: 'active',
    successorId: null,
    termEndedAt: null,
    termStartedAt: null,
    title: null,
  };
}

test('resolves only HTTP poll media URLs', () => {
  expect(resolvePollImageUrl('/images/person.png')).toBe(
    'https://syrian.zone/images/person.png',
  );
  expect(resolvePollImageUrl('https://cdn.example.test/person.png')).toBe(
    'https://cdn.example.test/person.png',
  );
  expect(resolvePollImageUrl('//attacker.example/image.png')).toBeNull();
  expect(resolvePollImageUrl('file:///private/data')).toBeNull();
});

test('shares a captured tier board only when native sharing is available', async () => {
  const share = jest.fn(async () => undefined);
  const capture = jest.fn(async () => 'file:///cache/tier-board.png');

  await expect(
    shareCapturedPollImage(null, {
      capture,
      isAvailable: async () => true,
      share,
    }),
  ).resolves.toBe(true);
  expect(share).toHaveBeenCalledWith('file:///cache/tier-board.png', {
    mimeType: 'image/png',
    UTI: 'public.png',
  });

  share.mockClear();
  await expect(
    shareCapturedPollImage(null, {
      capture,
      isAvailable: async () => false,
      share,
    }),
  ).resolves.toBe(false);
  expect(share).not.toHaveBeenCalled();
});

test('uses the shared native image exporter for the default capture path', async () => {
  jest.mocked(shareCapturedView).mockResolvedValue(true);

  await expect(shareCapturedPollImage(null)).resolves.toBe(true);

  expect(shareCapturedView).toHaveBeenCalledWith(null, 'tier-board');
});

test('creates a bounded candidate archive and always cleans temporary files', async () => {
  const cleanup = jest.fn(async () => undefined);
  const shareArchive = jest.fn(async () => undefined);
  const archive = jest.fn(async (files: readonly { bytes: Uint8Array; name: string }[]) => {
    expect(files.map(({ name }) => name)).toEqual(['1.png', '2.jpg']);
    return new Uint8Array([9, 8, 7]);
  });
  const download = jest.fn(async (url: string) => ({
    bytes: new Uint8Array(url.endsWith('.png') ? [1] : [2, 3]),
    name: url.endsWith('.png') ? '1.png' : '2.jpg',
  }));

  await createAndShareCandidateArchive(
    [candidate('one', '/one.png'), candidate('two', 'https://cdn.example/two.jpg')],
    { archive, cleanup, download, shareArchive },
  );

  expect(shareArchive).toHaveBeenCalledWith(
    new Uint8Array([9, 8, 7]),
    'syrianzone-candidates.zip',
  );
  expect(cleanup).toHaveBeenCalledTimes(1);
});

test('rejects an oversized archive before downloading anything', async () => {
  const download = jest.fn();
  const entries = Array.from({ length: 21 }, (_, index) =>
    candidate(String(index), `/candidate-${index}.png`),
  );

  await expect(
    createAndShareCandidateArchive(entries, {
      archive: jest.fn(),
      cleanup: jest.fn(),
      download,
      shareArchive: jest.fn(),
    }),
  ).rejects.toThrow('archive_limit');
  expect(download).not.toHaveBeenCalled();
});
