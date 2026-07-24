import { fireEvent, render } from '@testing-library/react-native';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import { routeColors } from '../_lib/mapColors';
import { RouteColorSelector } from './RouteColorSelector';

test('offers the eight source route colors as an accessible single choice', async () => {
  const onChange = jest.fn();
  const view = await render(
    <LocaleProvider>
      <AppThemeProvider>
        <RouteColorSelector onChange={onChange} value={2} />
      </AppThemeProvider>
    </LocaleProvider>,
  );

  expect(routeColors).toEqual([
    '#e8a838',
    '#c44b4b',
    '#4a8fa8',
    '#7ab87a',
    '#d4956a',
    '#9b6bb5',
    '#5ba08a',
    '#c9784a',
  ]);
  expect(view.getAllByRole('radio')).toHaveLength(8);
  expect(
    view.getByRole('radio', { name: 'لون المسار 3' }).props
      .accessibilityState,
  ).toEqual({ checked: true });

  fireEvent.press(view.getByRole('radio', { name: 'لون المسار 8' }));

  expect(onChange).toHaveBeenCalledWith(7);
});
