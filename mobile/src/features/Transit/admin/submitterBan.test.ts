import { Alert } from 'react-native';

import { confirmTransitSubmitterBan } from './Index';

jest.mock('../_components/citymap/MapView', () => ({
  TransitMapView: () => null,
}));

jest.mock('../_hooks/useMapData', () => ({
  useMapData: () => ({ data: null }),
}));

describe('transit submitter moderation confirmation', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test.each([
    {
      actionText: 'حظر',
      currentState: false,
      expectedState: true,
      title: 'حظر المساهم؟',
    },
    {
      actionText: 'إلغاء الحظر',
      currentState: true,
      expectedState: false,
      title: 'إلغاء حظر المساهم؟',
    },
  ])('confirms $actionText before posting the desired state', ({
    actionText,
    currentState,
    expectedState,
    title,
  }) => {
    const onConfirm = jest.fn();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation();

    confirmTransitSubmitterBan({ id: 7, isBanned: currentState, onConfirm });

    expect(alert).toHaveBeenCalledWith(title, expect.any(String), expect.any(Array));
    const action = alert.mock.calls[0]?.[2]?.find(
      (candidate) => candidate.text === actionText,
    );
    action?.onPress?.();
    expect(onConfirm).toHaveBeenCalledWith({ id: 7, isBanned: expectedState });
  });
});
