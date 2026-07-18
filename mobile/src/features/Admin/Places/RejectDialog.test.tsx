import { fireEvent, render } from '@testing-library/react-native';

import { AppThemeProvider } from '@/contexts/ThemeContext';
import { LocaleProvider } from '@/contexts/LocaleContext';

import { RejectDialog } from './RejectDialog';

async function renderDialog(
  overrides: Partial<React.ComponentProps<typeof RejectDialog>> = {},
) {
  const props: React.ComponentProps<typeof RejectDialog> = {
    busy: false,
    onConfirm: jest.fn(),
    onOpenChange: jest.fn(),
    open: true,
    ...overrides,
  };
  return {
    props,
    view: await render(
      <LocaleProvider>
        <AppThemeProvider>
          <RejectDialog {...props} />
        </AppThemeProvider>
      </LocaleProvider>,
    ),
  };
}

test('trims a rejection reason before confirmation', async () => {
  const { props, view } = await renderDialog();

  await fireEvent.changeText(view.getByLabelText('سبب الرفض'), '  أضف تفاصيل أدق  ');
  await fireEvent.press(view.getByText('تأكيد الرفض'));

  expect(props.onConfirm).toHaveBeenCalledWith('أضف تفاصيل أدق');
});

test('submits null for an empty optional reason', async () => {
  const { props, view } = await renderDialog();

  await fireEvent.changeText(view.getByLabelText('سبب الرفض'), '   ');
  await fireEvent.press(view.getByText('تأكيد الرفض'));

  expect(props.onConfirm).toHaveBeenCalledWith(null);
});

test('prompts for a clear contributor-facing reason', async () => {
  const { view } = await renderDialog();

  expect(view.getByPlaceholderText('اكتب سبباً واضحاً يساعد المساهم على التحسين، مثال: الصور غير واضحة، أو الوصف لا يذكر ما يميز المكان')).toBeTruthy();
});

test('closes on cancel and blocks actions while busy', async () => {
  const { props, view } = await renderDialog({ busy: true });

  await fireEvent.press(view.getByText('إلغاء'));
  await fireEvent.press(view.getByText('تأكيد الرفض'));

  expect(props.onOpenChange).not.toHaveBeenCalled();
  expect(props.onConfirm).not.toHaveBeenCalled();
});
