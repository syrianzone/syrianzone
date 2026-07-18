import {
  act,
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

import { AppThemeProvider } from '@/contexts/ThemeContext';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { placesApi } from '@/features/Places/_lib/api';
import { googleMapsUrl } from '@/features/Places/model';
import { openSafeExternalUrl } from '@/lib/linking';
import { adminPlace } from '@/test/fixtures/places';

import { PlaceReviewCard } from './PlaceReviewCard';

jest.mock('expo-file-system', () => ({
  File: class {
    size = 1024;
  },
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
}));

jest.mock('@/features/Places/_lib/api', () => ({
  placesApi: {
    adminAddPhoto: jest.fn(),
    adminDeletePhoto: jest.fn(),
    adminReplacePhoto: jest.fn(),
    adminRotatePhoto: jest.fn(),
    adminUpdatePlace: jest.fn(),
  },
}));

jest.mock('@/lib/linking', () => ({
  openSafeExternalUrl: jest.fn(async () => true),
}));

async function renderCard(
  overrides: Partial<React.ComponentProps<typeof PlaceReviewCard>> = {},
) {
  const props: React.ComponentProps<typeof PlaceReviewCard> = {
    busy: false,
    onApprove: jest.fn(async () => undefined),
    onChanged: jest.fn(async () => undefined),
    onDelete: jest.fn(),
    onReject: jest.fn(async () => undefined),
    place: adminPlace,
    ...overrides,
  };
  return {
    props,
    view: await render(
      <LocaleProvider>
        <AppThemeProvider>
          <PlaceReviewCard {...props} />
        </AppThemeProvider>
      </LocaleProvider>,
    ),
  };
}

const pickedAsset = {
  fileName: 'courtyard.jpg',
  fileSize: 2048,
  height: 900,
  mimeType: 'image/jpeg',
  uri: 'file:///courtyard.jpg',
  width: 1200,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({
    canAskAgain: true,
    expires: 'never',
    granted: true,
    status: 'granted' as ImagePicker.PermissionStatus,
  });
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
    assets: [pickedAsset],
    canceled: false,
  });
  jest.mocked(placesApi.adminAddPhoto).mockResolvedValue(adminPlace.photos[0]!);
  jest.mocked(placesApi.adminDeletePhoto).mockResolvedValue(undefined);
  jest.mocked(placesApi.adminReplacePhoto).mockResolvedValue(adminPlace.photos[0]!);
  jest.mocked(placesApi.adminRotatePhoto).mockResolvedValue(adminPlace.photos[0]!);
  jest.mocked(placesApi.adminUpdatePlace).mockResolvedValue(adminPlace);
});

test('routes map, approval, and permanent deletion actions', async () => {
  const { props, view } = await renderCard();

  await fireEvent.press(view.getByText(`${adminPlace.lat.toFixed(5)}, ${adminPlace.lng.toFixed(5)}`));
  await fireEvent.press(view.getByText('موافقة'));
  await fireEvent.press(view.getByText('حذف نهائي'));

  expect(openSafeExternalUrl).toHaveBeenCalledWith(googleMapsUrl(adminPlace));
  expect(props.onApprove).toHaveBeenCalledTimes(1);
  expect(props.onDelete).toHaveBeenCalledTimes(1);
});

test('collects an optional rejection reason before rejecting', async () => {
  const { props, view } = await renderCard();

  await fireEvent.press(view.getByText('رفض'));
  await fireEvent.changeText(view.getByLabelText('سبب الرفض'), '  الصورة غير واضحة  ');
  await fireEvent.press(view.getByText('تأكيد الرفض'));

  await waitFor(() => expect(props.onReject).toHaveBeenCalledWith('الصورة غير واضحة'));
  await waitFor(() => expect(view.queryByText('تأكيد الرفض')).toBeNull());
});

test('saves edited fields and refreshes the review list', async () => {
  const updated = { ...adminPlace, name: 'بيت دمشقي مجدد' };
  jest.mocked(placesApi.adminUpdatePlace).mockResolvedValue(updated);
  const { props, view } = await renderCard();

  await fireEvent.press(view.getByText('تعديل'));
  await fireEvent.changeText(view.getByDisplayValue(adminPlace.name), updated.name);
  await fireEvent.press(view.getByText('حفظ'));

  await waitFor(() => {
    expect(placesApi.adminUpdatePlace).toHaveBeenCalledWith(adminPlace.id, {
      name: updated.name,
    });
  });
  expect(props.onChanged).toHaveBeenCalledTimes(1);
});

test('uploads selected photos for add and replace operations', async () => {
  const { props, view } = await renderCard();
  const upload = {
    fileName: pickedAsset.fileName,
    fileSize: pickedAsset.fileSize,
    mimeType: pickedAsset.mimeType,
    uri: pickedAsset.uri,
  };

  await fireEvent.press(view.getByText('إضافة صورة'));
  await waitFor(() => expect(placesApi.adminAddPhoto).toHaveBeenCalledWith(adminPlace.id, upload));

  await fireEvent.press(view.getAllByText('استبدال')[0]!);
  await waitFor(() => expect(placesApi.adminReplacePhoto).toHaveBeenCalledWith(adminPlace.photos[0]!.id, upload));
  expect(props.onChanged).toHaveBeenCalledTimes(2);
});

test('allows admin uploads until the current ten-photo limit', async () => {
  const photos = Array.from({ length: 5 }, (_, index) => ({
    ...adminPlace.photos[0]!,
    id: 100 + index,
    sort: index,
  }));
  const { view } = await renderCard({ place: { ...adminPlace, photos } });

  expect(view.getByText('إضافة صورة')).toBeTruthy();
});

test('holds one card-wide lock while a photo operation is pending', async () => {
  let resolvePicker: (
    result: Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>,
  ) => void = () => undefined;
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockImplementation(
    () => new Promise((resolve) => {
      resolvePicker = resolve;
    }),
  );
  const { props, view } = await renderCard();

  await fireEvent.press(view.getByText('إضافة صورة'));
  await fireEvent.press(view.getAllByText('تدوير')[0]!);
  await fireEvent.press(view.getByText('موافقة'));
  await fireEvent.press(view.getByText('حذف نهائي'));
  await act(async () => {
    resolvePicker({ assets: [pickedAsset], canceled: false });
  });

  await waitFor(() => expect(placesApi.adminAddPhoto).toHaveBeenCalledTimes(1));
  expect(placesApi.adminRotatePhoto).not.toHaveBeenCalled();
  expect(props.onApprove).not.toHaveBeenCalled();
  expect(props.onDelete).not.toHaveBeenCalled();
});

test('confirms a photo deletion before refreshing', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  const { props, view } = await renderCard();

  await fireEvent.press(view.getAllByText('حذف')[0]!);
  expect(placesApi.adminDeletePhoto).not.toHaveBeenCalled();
  const buttons = alert.mock.calls[0]?.[2];
  await act(async () => {
    buttons?.find((button) => button.style === 'destructive')?.onPress?.();
  });

  await waitFor(() => expect(placesApi.adminDeletePhoto).toHaveBeenCalledWith(adminPlace.photos[0]!.id));
  expect(props.onChanged).toHaveBeenCalledTimes(1);
});

test('shows a photo operation error without refreshing', async () => {
  jest.mocked(placesApi.adminRotatePhoto).mockRejectedValue(new Error('فشل تدوير الصورة'));
  const { props, view } = await renderCard();

  await fireEvent.press(view.getAllByText('تدوير')[0]!);

  await waitFor(() => expect(view.getByText('فشل تدوير الصورة')).toBeTruthy());
  expect(props.onChanged).not.toHaveBeenCalled();
});
