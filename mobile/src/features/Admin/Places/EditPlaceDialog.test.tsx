import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { AppThemeProvider } from '@/contexts/ThemeContext';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { placesApi } from '@/features/Places/_lib/api';
import { adminPlace } from '@/test/fixtures/places';

import { EditPlaceDialog } from './EditPlaceDialog';

jest.mock('@/features/Places/_lib/api', () => ({
  placesApi: {
    adminUpdatePlace: jest.fn(),
  },
}));

async function renderDialog(
  overrides: Partial<React.ComponentProps<typeof EditPlaceDialog>> = {},
) {
  const props: React.ComponentProps<typeof EditPlaceDialog> = {
    onOpenChange: jest.fn(),
    onSaved: jest.fn(),
    open: true,
    place: adminPlace,
    ...overrides,
  };
  return {
    props,
    view: await render(
      <LocaleProvider>
        <AppThemeProvider>
          <EditPlaceDialog {...props} />
        </AppThemeProvider>
      </LocaleProvider>,
    ),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(placesApi.adminUpdatePlace).mockResolvedValue(adminPlace);
});

test('sends only changed fields and returns the updated place', async () => {
  const updated = { ...adminPlace, category: 'cultural' as const, name: 'بيت الثقافة' };
  jest.mocked(placesApi.adminUpdatePlace).mockResolvedValue(updated);
  const { props, view } = await renderDialog();

  await fireEvent.changeText(view.getByDisplayValue(adminPlace.name), '  بيت الثقافة  ');
  await fireEvent.press(view.getByText('ثقافي'));
  await fireEvent.press(view.getByText('حفظ'));

  await waitFor(() => {
    expect(placesApi.adminUpdatePlace).toHaveBeenCalledWith(adminPlace.id, {
      category: 'cultural',
      name: 'بيت الثقافة',
    });
  });
  expect(props.onSaved).toHaveBeenCalledWith(updated);
  expect(props.onOpenChange).toHaveBeenCalledWith(false);
});

test('shows validation errors without making a request', async () => {
  const { view } = await renderDialog();

  await fireEvent.changeText(view.getByDisplayValue(String(adminPlace.lat)), '40');
  await fireEvent.press(view.getByText('حفظ'));

  expect(view.getByText('الإحداثيات خارج حدود سوريا')).toBeTruthy();
  expect(placesApi.adminUpdatePlace).not.toHaveBeenCalled();
});

test('closes unchanged edits without making a request', async () => {
  const { props, view } = await renderDialog();

  await fireEvent.press(view.getByText('حفظ'));

  expect(placesApi.adminUpdatePlace).not.toHaveBeenCalled();
  expect(props.onOpenChange).toHaveBeenCalledWith(false);
});

test('keeps the editor open and shows request failures', async () => {
  jest.mocked(placesApi.adminUpdatePlace).mockRejectedValue(new Error('تعارض في التعديل'));
  const { props, view } = await renderDialog();

  await fireEvent.changeText(view.getByDisplayValue(adminPlace.name), 'بيت آخر');
  await fireEvent.press(view.getByText('حفظ'));

  await waitFor(() => expect(view.getByText('تعارض في التعديل')).toBeTruthy());
  expect(props.onSaved).not.toHaveBeenCalled();
  expect(props.onOpenChange).not.toHaveBeenCalled();
});
