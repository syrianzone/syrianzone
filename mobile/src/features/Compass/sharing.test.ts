import { shareCompassResultCard } from './sharing';

describe('compass result sharing', () => {
  test('shares the captured card as a JPG and releases it', async () => {
    const dependencies = {
      capture: jest.fn(async () => 'file:///tmp/compass-results.jpg'),
      isAvailable: jest.fn(async () => true),
      release: jest.fn(),
      share: jest.fn(async () => undefined),
    };

    await expect(
      shareCompassResultCard({} as never, dependencies),
    ).resolves.toBe(true);
    expect(dependencies.share).toHaveBeenCalledWith(
      'file:///tmp/compass-results.jpg',
      { mimeType: 'image/jpeg', UTI: 'public.jpeg' },
    );
    expect(dependencies.release).toHaveBeenCalledWith(
      'file:///tmp/compass-results.jpg',
    );
  });

  test('does not capture when native sharing is unavailable', async () => {
    const dependencies = {
      capture: jest.fn(async () => 'unused'),
      isAvailable: jest.fn(async () => false),
      release: jest.fn(),
      share: jest.fn(async () => undefined),
    };

    await expect(
      shareCompassResultCard({} as never, dependencies),
    ).resolves.toBe(false);
    expect(dependencies.capture).not.toHaveBeenCalled();
  });

  test('releases the capture after a failed share', async () => {
    const dependencies = {
      capture: jest.fn(async () => 'file:///tmp/compass-results.jpg'),
      isAvailable: jest.fn(async () => true),
      release: jest.fn(),
      share: jest.fn(async () => {
        throw new Error('cancelled');
      }),
    };

    await expect(
      shareCompassResultCard({} as never, dependencies),
    ).rejects.toThrow('cancelled');
    expect(dependencies.release).toHaveBeenCalledWith(
      'file:///tmp/compass-results.jpg',
    );
  });
});
