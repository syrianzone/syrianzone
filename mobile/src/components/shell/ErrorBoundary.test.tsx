import { fireEvent, render } from '@testing-library/react-native';

import { AppErrorBoundary } from './ErrorBoundary';

// Rendered bare on purpose: the boundary replaces the root layout, so it has to
// work with no provider above it.
test('shows the bilingual crash card with the thrown error message', async () => {
  const view = await render(
    <AppErrorBoundary
      error={new Error("Cannot read property 'slug' of undefined")}
      retry={jest.fn()}
    />,
  );

  expect(view.getByText('حدث خطأ غير متوقع')).toBeTruthy();
  expect(view.getByText('Something went wrong')).toBeTruthy();
  expect(
    view.getByText("Cannot read property 'slug' of undefined"),
  ).toBeTruthy();
});

test('falls back to a readable label when the error carries no message', async () => {
  const view = await render(
    <AppErrorBoundary error={new Error('')} retry={jest.fn()} />,
  );

  expect(view.getByText('Unknown error')).toBeTruthy();
});

test('retries the crashed route when the retry button is pressed', async () => {
  const retry = jest.fn(async () => {});
  const view = await render(
    <AppErrorBoundary error={new Error('boom')} retry={retry} />,
  );

  await fireEvent.press(view.getByText('إعادة المحاولة'));

  expect(retry).toHaveBeenCalledTimes(1);
});
