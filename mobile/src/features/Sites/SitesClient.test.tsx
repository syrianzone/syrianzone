import { fireEvent, render } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';
import { websiteFixture } from '@/test/fixtures/directories';

import SitesClient from './SitesClient';
import type { Website } from './types';

function Providers({ children }: PropsWithChildren) {
  return (
    <LocaleProvider>
      <AppThemeProvider>{children}</AppThemeProvider>
    </LocaleProvider>
  );
}

test('sites keep the first-party favicon in list mode, not only in cards', async () => {
  const view = await render(<SitesClient initialWebsites={websiteFixture} />, {
    wrapper: Providers,
  });

  await fireEvent.press(view.getByLabelText('قائمة'));
  expect(view.getByTestId('site-favicon-image-site-news').props.source).toEqual(
    [{ uri: 'https://news.example.com/favicon.ico' }],
  );
});

test('sites fall back to the bundled globe when a URL carries no origin', async () => {
  const unreachable: Website = {
    description: 'موقع بعنوان غير صالح',
    id: 'site-broken',
    name: 'موقع بلا رابط',
    type: 'دليل',
    url: 'not-a-url',
  };
  const view = await render(<SitesClient initialWebsites={[unreachable]} />, {
    wrapper: Providers,
  });

  expect(view.getByTestId('site-favicon-site-broken')).toBeTruthy();
  expect(view.queryByTestId('site-favicon-image-site-broken')).toBeNull();
});
