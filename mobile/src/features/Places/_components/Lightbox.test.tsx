import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Sharing from 'expo-sharing';

import { AppThemeProvider } from '@/contexts/ThemeContext';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { placePhotos } from '@/test/fixtures/places';

import { Lightbox } from './Lightbox';

jest.mock('expo-image', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Image } = jest.requireActual<typeof import('react-native')>('react-native');
  return { Image: (props: object) => React.createElement(Image, props) };
});

jest.mock('expo-file-system', () => {
  const files: MockFile[] = [];
  const directories: MockDirectory[] = [];
  const downloadFileAsync = jest.fn(async (_url: string, target: MockFile) => target);

  class MockFile {
    bytes = jest.fn(async () => new Uint8Array([1, 2, 3, 4]));
    create = jest.fn();
    delete = jest.fn(() => {
      this.exists = false;
    });
    exists = true;
    size = 4;
    type = 'image/jpeg';
    uri: string;
    write = jest.fn();

    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map((part) => typeof part === 'string' ? part : part.uri).join('/');
      files.push(this);
    }

    static downloadFileAsync = downloadFileAsync;
  }

  class MockDirectory {
    create = jest.fn();
    delete = jest.fn(() => {
      this.exists = false;
    });
    exists = true;
    uri: string;

    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map((part) => typeof part === 'string' ? part : part.uri).join('/');
      directories.push(this);
    }
  }

  return {
    Directory: MockDirectory,
    File: MockFile,
    Paths: { cache: { uri: 'cache:' } },
    __mock: { directories, downloadFileAsync, files },
  };
});

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

interface MockFile {
  bytes: jest.Mock;
  create: jest.Mock;
  delete: jest.Mock;
  exists: boolean;
  size: number;
  type: string;
  uri: string;
  write: jest.Mock;
}

interface MockDirectory {
  create: jest.Mock;
  delete: jest.Mock;
  exists: boolean;
  uri: string;
}

interface FileSystemHarness {
  directories: MockDirectory[];
  downloadFileAsync: jest.Mock;
  files: MockFile[];
}

const fileSystem = (jest.requireMock('expo-file-system') as { __mock: FileSystemHarness }).__mock;

async function renderLightbox(
  overrides: Partial<React.ComponentProps<typeof Lightbox>> = {},
) {
  const props: React.ComponentProps<typeof Lightbox> = {
    index: 0,
    name: 'بيت: دمشقي',
    onClose: jest.fn(),
    open: true,
    photos: placePhotos,
    ...overrides,
  };
  return {
    props,
    view: await render(
      <LocaleProvider>
        <AppThemeProvider>
          <Lightbox {...props} />
        </AppThemeProvider>
      </LocaleProvider>,
    ),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  fileSystem.directories.length = 0;
  fileSystem.files.length = 0;
  fileSystem.downloadFileAsync.mockImplementation(async (_url: string, target: MockFile) => target);
  jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
  jest.mocked(Sharing.shareAsync).mockResolvedValue(undefined);
});

test('opens at the requested photo, pages within bounds, and closes', async () => {
  const { props, view } = await renderLightbox({ index: 1 });

  expect(view.getByText('2 / 2')).toBeTruthy();
  expect(view.getByLabelText('بيت: دمشقي 2')).toBeTruthy();

  await fireEvent.press(view.getByLabelText('الصورة السابقة'));
  expect(view.getByText('1 / 2')).toBeTruthy();
  await fireEvent.press(view.getByLabelText('الصورة السابقة'));
  expect(view.getByText('1 / 2')).toBeTruthy();
  await fireEvent.press(view.getByLabelText('الصورة التالية'));
  expect(view.getByText('2 / 2')).toBeTruthy();
  await fireEvent.press(view.getByLabelText('إغلاق معرض الصور'));
  expect(props.onClose).toHaveBeenCalledTimes(1);
});

test('downloads the current photo, shares it, and deletes the cache file', async () => {
  const { view } = await renderLightbox({ photos: [placePhotos[0]!] });

  await fireEvent.press(view.getByText('تحميل'));

  await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalledTimes(1));
  expect(fileSystem.downloadFileAsync).toHaveBeenCalledWith(
    placePhotos[0]!.display_url,
    expect.objectContaining({ uri: expect.stringContaining('بيت- دمشقي-71.webp') }),
    { idempotent: true },
  );
  expect(Sharing.shareAsync).toHaveBeenCalledWith(
    expect.stringContaining('بيت- دمشقي-71.webp'),
    { mimeType: 'image/jpeg' },
  );
  expect(fileSystem.files[0]?.delete).toHaveBeenCalledTimes(1);
});

test('deletes the current cache file when its download fails', async () => {
  fileSystem.downloadFileAsync.mockRejectedValueOnce(new Error('offline'));
  const { view } = await renderLightbox({ photos: [placePhotos[0]!] });

  await fireEvent.press(view.getByText('تحميل'));

  await waitFor(() => expect(view.getByText('تعذر تحميل الصورة')).toBeTruthy());
  expect(Sharing.shareAsync).not.toHaveBeenCalled();
  expect(fileSystem.files[0]?.delete).toHaveBeenCalledTimes(1);
});

test('builds and shares an archive before deleting its cache directory', async () => {
  const { view } = await renderLightbox();

  await fireEvent.press(view.getByText('تحميل الكل'));

  await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalledTimes(1));
  expect(fileSystem.downloadFileAsync).toHaveBeenCalledTimes(2);
  expect(Sharing.shareAsync).toHaveBeenCalledWith(
    expect.stringContaining('بيت- دمشقي.zip'),
    { mimeType: 'application/zip', UTI: 'public.zip-archive' },
  );
  expect(fileSystem.files.at(-1)?.write).toHaveBeenCalledWith(expect.any(Uint8Array));
  expect(fileSystem.directories[0]?.delete).toHaveBeenCalledTimes(1);
});

test('shares partial archives, reports skipped photos, and still cleans up', async () => {
  fileSystem.downloadFileAsync
    .mockRejectedValueOnce(new Error('offline'))
    .mockImplementationOnce(async (_url: string, target: MockFile) => target);
  const { view } = await renderLightbox();

  await fireEvent.press(view.getByText('تحميل الكل'));

  await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalledTimes(1));
  expect(view.getByText('تعذر تحميل بعض الصور')).toBeTruthy();
  expect(fileSystem.directories[0]?.delete).toHaveBeenCalledTimes(1);
});

test('reports unavailable sharing without creating download artifacts', async () => {
  jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(false);
  const { view } = await renderLightbox();

  await fireEvent.press(view.getByText('تحميل الكل'));

  await waitFor(() => expect(view.getByText('تعذر تحميل بعض الصور')).toBeTruthy());
  expect(fileSystem.downloadFileAsync).not.toHaveBeenCalled();
  expect(fileSystem.directories).toHaveLength(0);
});
