import { sharePriorityStory } from './sharing';

describe('priority story sharing', () => {
  test('shares and releases the captured story card', async () => {
    const dependencies = {
      capture: jest.fn(async () => 'file:///tmp/priorities.png'),
      isAvailable: jest.fn(async () => true),
      release: jest.fn(),
      share: jest.fn(async () => undefined),
    };

    await expect(
      sharePriorityStory({} as never, dependencies),
    ).resolves.toBe(true);
    expect(dependencies.share).toHaveBeenCalledWith(
      'file:///tmp/priorities.png',
      { mimeType: 'image/png', UTI: 'public.png' },
    );
    expect(dependencies.release).toHaveBeenCalledWith(
      'file:///tmp/priorities.png',
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
      sharePriorityStory({} as never, dependencies),
    ).resolves.toBe(false);
    expect(dependencies.capture).not.toHaveBeenCalled();
  });

  test('releases the story capture after a share error', async () => {
    const dependencies = {
      capture: jest.fn(async () => 'file:///tmp/priorities.png'),
      isAvailable: jest.fn(async () => true),
      release: jest.fn(),
      share: jest.fn(async () => {
        throw new Error('cancelled');
      }),
    };

    await expect(
      sharePriorityStory({} as never, dependencies),
    ).rejects.toThrow('cancelled');
    expect(dependencies.release).toHaveBeenCalledWith(
      'file:///tmp/priorities.png',
    );
  });
});
