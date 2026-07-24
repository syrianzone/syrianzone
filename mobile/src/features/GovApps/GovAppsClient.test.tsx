import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import GovAppsClient from './GovAppsClient';
import type { GovApp } from './types';

const app: GovApp = {
  description:
    'وصف طويل للتطبيق الحكومي يجب أن يتمكن المستخدم من توسيعه وتقليصه.',
  icon: 'https://media.example.com/govapps/app.webp',
  id: 'services',
  images: ['https://stale.example.com/screenshot.webp'],
  links: { official: 'https://services.gov.sy' },
  name: 'خدماتي',
};

test('uses database media and toggles the full description without a gallery', async () => {
  const view = await render(
    <LocaleProvider>
      <AppThemeProvider>
        <GovAppsClient initialData={[app]} />
      </AppThemeProvider>
    </LocaleProvider>,
  );

  const description = view.getByText(app.description);
  expect(description.props.numberOfLines).toBe(2);
  await fireEvent.press(view.getByTestId('govapp-description-services'));
  await waitFor(() =>
    expect(
      view.getByText(app.description).props.numberOfLines,
    ).toBeUndefined(),
  );
  expect(view.queryByText('لقطات الشاشة')).toBeNull();
});
