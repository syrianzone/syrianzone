import { useQuery } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import SyrianContributorsPage from './Index';

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
}));

beforeEach(() => {
  jest.mocked(useQuery).mockReturnValue({
    data: [],
    isError: false,
    isPending: false,
    isRefetching: false,
    refetch: jest.fn(),
  } as never);
});

test('uses the contributor screen title and description from its layout contract', async () => {
  const view = await render(
    <LocaleProvider>
      <AppThemeProvider>
        <SyrianContributorsPage />
      </AppThemeProvider>
    </LocaleProvider>,
  );

  expect(
    view.getByText('أفضل المساهمين السوريين في GitHub'),
  ).toBeTruthy();
  expect(
    view.getByText(
      'تكريم المطورين السوريين المساهمين في المصادر المفتوحة والبرمجيات الحرة.',
    ),
  ).toBeTruthy();
});
