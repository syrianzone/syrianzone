import { apiClient } from './client';
import { uploadImage } from './uploads';

jest.mock('./client', () => ({
  apiClient: {
    request: jest.fn(),
  },
}));

test('preserves the selected image media type in the admin upload', async () => {
  const append = jest.spyOn(FormData.prototype, 'append');
  jest.mocked(apiClient.request).mockResolvedValue({
    data: { url: 'https://cdn.example.test/candidate.png' },
  } as never);

  await uploadImage('file:///candidate.png', 'candidate.png');

  expect(append).toHaveBeenCalledWith(
    'image',
    expect.objectContaining({
      name: 'candidate.png',
      type: 'image/png',
      uri: 'file:///candidate.png',
    }),
  );
  append.mockRestore();
});
