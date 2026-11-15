import { expect, test } from 'bun:test';
import { prepareExportFile } from './file-export-flow';
test('native encoder cannot read until asynchronous file write completes, and source survives until encoding finishes', async () => {
  const events: string[] = [];
  let finishWrite!: () => void, finishEncode!: () => void;
  const written = new Promise<void>((resolve) => {
      finishWrite = resolve;
    }),
    encoded = new Promise<void>((resolve) => {
      finishEncode = resolve;
    });
  const result = prepareExportFile(
    {
      write: () =>
        written.then(() => {
          events.push('written');
        }),
      encode: () => {
        events.push('encode');
        return encoded.then(() => 'image');
      },
      removeSource: () => {
        events.push('remove-source');
      },
      removeOutput: () => {
        events.push('remove-output');
      },
    },
    () => false,
  );
  await Promise.resolve();
  expect(events).toEqual([]);
  finishWrite();
  await Promise.resolve();
  await Promise.resolve();
  expect(events).toEqual(['written', 'encode']);
  finishEncode();
  expect(await result).toBe('image');
  expect(events).toEqual(['written', 'encode', 'remove-source']);
});
test('failed writes never invoke the encoder and an abort during encoding removes its completed output', async () => {
  let encoded = false,
    removedSource = 0,
    removedOutput = 0,
    aborted = false;
  await expect(
    prepareExportFile(
      {
        write: async () => {
          throw new Error('disk');
        },
        encode: async () => {
          encoded = true;
          return 'image';
        },
        removeSource: () => {
          removedSource++;
        },
        removeOutput: () => {
          removedOutput++;
        },
      },
      () => false,
    ),
  ).rejects.toThrow('disk');
  expect(encoded).toBe(false);
  expect(removedSource).toBe(1);
  await expect(
    prepareExportFile(
      {
        write: async () => {},
        encode: async () => {
          aborted = true;
          return 'image';
        },
        removeSource: () => {
          removedSource++;
        },
        removeOutput: () => {
          removedOutput++;
        },
      },
      () => aborted,
    ),
  ).rejects.toThrow();
  expect(removedSource).toBe(2);
  expect(removedOutput).toBe(1);
});
