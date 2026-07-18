import { shareCompassRaster } from './sharing';

describe('alignment raster sharing', () => {
  test.each([
    ['png', 'image/png', 'public.png'],
    ['jpg', 'image/jpeg', 'public.jpeg'],
  ] as const)('captures and releases a %s export', async (format, mimeType, UTI) => {
    const dependencies = {
      capture: jest.fn(async () => 'file:///tmp/compass.jpg'),
      isAvailable: jest.fn(async () => true),
      release: jest.fn(),
      share: jest.fn(async () => undefined),
    };

    await expect(
      shareCompassRaster({} as never, format, dependencies),
    ).resolves.toBe(true);
    expect(dependencies.capture).toHaveBeenCalledWith({}, format);
    expect(dependencies.share).toHaveBeenCalledWith(
      'file:///tmp/compass.jpg',
      { mimeType, UTI },
    );
    expect(dependencies.release).toHaveBeenCalledWith(
      'file:///tmp/compass.jpg',
    );
  });

  test('releases a capture when native sharing fails', async () => {
    const dependencies = {
      capture: jest.fn(async () => 'file:///tmp/compass.png'),
      isAvailable: jest.fn(async () => true),
      release: jest.fn(),
      share: jest.fn(async () => {
        throw new Error('cancelled');
      }),
    };

    await expect(
      shareCompassRaster({} as never, 'png', dependencies),
    ).rejects.toThrow('cancelled');
    expect(dependencies.release).toHaveBeenCalledWith(
      'file:///tmp/compass.png',
    );
  });
});
