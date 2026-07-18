import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';
import { adminPlace } from '@/test/fixtures/places';

import { placesApi } from '../_lib/api';
import type { MyPlace } from '../_lib/types';
import { ManagePlaceDialog } from './ManagePlaceDialog';

jest.mock('../_lib/api', () => ({
  placesApi: {
    addMyPhoto: jest.fn(),
    deleteMyPhoto: jest.fn(),
    deleteMyPlace: jest.fn(),
    getPlace: jest.fn(),
    rotateMyPhoto: jest.fn(),
    updateMyPlace: jest.fn(),
    updateMyPlaceLocation: jest.fn(),
  },
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
}));

const myPlace: MyPlace = {
  category: adminPlace.category,
  created_at: adminPlace.created_at,
  description: adminPlace.description,
  id: adminPlace.id,
  lat: adminPlace.lat,
  lng: adminPlace.lng,
  name: adminPlace.name,
  rejection_reason: null,
  saves_count: adminPlace.saves_count,
  status: 'approved',
  thumb_url: adminPlace.thumb_url,
};

async function renderDialog(
  overrides: Partial<React.ComponentProps<typeof ManagePlaceDialog>> = {},
) {
  const props: React.ComponentProps<typeof ManagePlaceDialog> = {
    onClose: jest.fn(),
    onUpdated: jest.fn(),
    place: myPlace,
    ...overrides,
  };
  const view = await render(
    <LocaleProvider>
      <AppThemeProvider>
        <ManagePlaceDialog {...props} />
      </AppThemeProvider>
    </LocaleProvider>,
  );
  await waitFor(() => expect(view.getByDisplayValue(adminPlace.name)).toBeTruthy());
  return { props, view };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(placesApi.getPlace).mockResolvedValue({ ...adminPlace, status: 'approved' });
  jest.mocked(placesApi.updateMyPlace).mockResolvedValue({
    category: 'food',
    description: adminPlace.description,
    id: adminPlace.id,
    name: 'مطبخ دمشقي',
    status: 'pending',
  });
  jest.mocked(placesApi.updateMyPlaceLocation).mockResolvedValue({
    id: adminPlace.id,
    lat: 34.73941,
    lng: 36.67507,
    status: 'pending',
  });
  jest.mocked(placesApi.rotateMyPhoto).mockResolvedValue({
    display_url: `${adminPlace.photos[0]!.display_url}&r=1`,
    id: adminPlace.photos[0]!.id,
    thumb_url: `${adminPlace.photos[0]!.thumb_url}&r=1`,
  });
  jest.mocked(placesApi.deleteMyPhoto).mockResolvedValue({
    id: adminPlace.photos[1]!.id,
    place_status: 'pending',
  });
  jest.mocked(placesApi.deleteMyPlace).mockResolvedValue(undefined);
  jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({
    canAskAgain: true,
    expires: 'never',
    granted: true,
    status: 'granted' as ImagePicker.PermissionStatus,
  });
});

test('edits owner details and explains that moderation is required again', async () => {
  const { props, view } = await renderDialog();

  await fireEvent.changeText(view.getByDisplayValue(adminPlace.name), '  مطبخ دمشقي  ');
  await fireEvent.press(view.getByText('مأكولات'));
  await act(async () => {
    fireEvent.press(view.getByText('حفظ التعديلات'));
  });

  await waitFor(() => expect(placesApi.updateMyPlace).toHaveBeenCalledWith(adminPlace.id, {
    category: 'food',
    name: 'مطبخ دمشقي',
  }));
  expect(view.getByText('تم الحفظ وستظهر التعديلات بعد موافقة المشرفين')).toBeTruthy();
  expect(view.getByText('قيد المراجعة')).toBeTruthy();
  expect(props.onUpdated).toHaveBeenCalledTimes(1);
});

test('moves the owner pin and returns it to the moderation queue', async () => {
  const { view } = await renderDialog();

  await fireEvent.changeText(view.getByLabelText('الإحداثيات الجديدة'), '34.73941, 36.67507');
  await fireEvent.press(view.getByText('حفظ الموقع'));

  await waitFor(() => expect(placesApi.updateMyPlaceLocation).toHaveBeenCalledWith(
    adminPlace.id,
    { lat: 34.73941, lng: 36.67507 },
  ));
  expect(view.getByText('تم تحديث الموقع وسيظهر التعديل بعد موافقة المشرفين')).toBeTruthy();
});

test('rotates photos without changing approval', async () => {
  const { view } = await renderDialog();

  await fireEvent.press(view.getAllByLabelText('تدوير الصورة')[0]!);

  await waitFor(() => expect(placesApi.rotateMyPhoto).toHaveBeenCalledWith(adminPlace.photos[0]!.id));
  expect(view.getByText('مقبول')).toBeTruthy();
});

test('confirms destructive photo and place deletion', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    const destructive = buttons?.find((button) => button.style === 'destructive');
    destructive?.onPress?.();
  });
  const { props, view } = await renderDialog();

  await fireEvent.press(view.getAllByLabelText('حذف الصورة')[1]!);
  await waitFor(() => expect(placesApi.deleteMyPhoto).toHaveBeenCalledWith(adminPlace.photos[1]!.id));
  await fireEvent.press(view.getByText('حذف المكان'));
  await waitFor(() => expect(placesApi.deleteMyPlace).toHaveBeenCalledWith(adminPlace.id));

  expect(props.onClose).toHaveBeenCalledTimes(1);
  alert.mockRestore();
});
