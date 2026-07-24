import { fireEvent, render } from '@testing-library/react-native';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import { GuideFilterChip } from './GuideFilterChip';

test('shows the active guide and clears the contribution filter', async () => {
  const onClear = jest.fn();
  const view = await render(
    <LocaleProvider>
      <AppThemeProvider>
        <GuideFilterChip guide={{ id: 5, name: 'ليلى' }} onClear={onClear} />
      </AppThemeProvider>
    </LocaleProvider>,
  );

  expect(view.getByText('مساهمات ليلى')).toBeTruthy();
  await fireEvent.press(view.getByLabelText('إلغاء التصفية'));
  expect(onClear).toHaveBeenCalledTimes(1);
});
