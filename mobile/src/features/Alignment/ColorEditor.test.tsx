import { fireEvent, render } from '@testing-library/react-native';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import { ColorEditor } from './ColorEditor';

async function renderEditor(onChange = jest.fn()) {
  return {
    onChange,
    view: await render(
      <LocaleProvider>
        <AppThemeProvider>
          <ColorEditor
            color="#4caf50"
            label="أعلى اليسار"
            onChange={onChange}
          />
        </AppThemeProvider>
      </LocaleProvider>,
    ),
  };
}

describe('alignment color editor', () => {
  test('normalizes a valid typed color on blur', async () => {
    const { onChange, view } = await renderEditor();
    const input = view.getByDisplayValue('#4caf50');

    await fireEvent.changeText(input, '#AA00FF');
    await fireEvent(input, 'endEditing');

    expect(onChange).toHaveBeenCalledWith('#aa00ff');
  });

  test('rejects an incomplete typed color', async () => {
    const { onChange, view } = await renderEditor();
    const input = view.getByDisplayValue('#4caf50');

    await fireEvent.changeText(input, '#123');
    await fireEvent(input, 'endEditing');

    expect(onChange).not.toHaveBeenCalled();
    expect(view.getByText('اكتب لوناً سداسياً كاملاً مثل #4caf50.')).toBeTruthy();
  });
});
