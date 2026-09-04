import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sharing from 'expo-sharing';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import CompassApp from './CompassApp';
import { DEFAULT_QUESTIONS } from './data';

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn(async () => 'file:///tmp/compass-results.jpg'),
  releaseCapture: jest.fn(),
}));

// Walking all 72 questions costs minutes of render time, and the scoring is
// covered by model.test.ts, so the screen runs on a short question set here.
jest.mock('./data', () => {
  const actual = jest.requireActual<typeof import('./data')>('./data');
  return { ...actual, DEFAULT_QUESTIONS: actual.DEFAULT_QUESTIONS.slice(0, 4) };
});

async function renderApp() {
  const view = await render(
    <LocaleProvider>
      <AppThemeProvider>
        <CompassApp />
      </AppThemeProvider>
    </LocaleProvider>,
  );
  await fireEvent.press(view.getByText('ابدأ الاختبار'));
  return view;
}

async function answerEveryQuestion(view: Awaited<ReturnType<typeof renderApp>>) {
  const last = DEFAULT_QUESTIONS.length - 1;
  for (let index = 0; index <= last; index += 1) {
    await fireEvent.press(view.getByLabelText('أوافق بشدة +2'));
    await fireEvent.press(
      view.getByText(index === last ? 'عرض النتائج' : 'التالي'),
    );
  }
}

describe('native compass screen', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.mocked(captureRef).mockClear();
    jest.mocked(Sharing.shareAsync).mockClear();
  });

  test('labels every answer button with the web legend wording', async () => {
    const view = await renderApp();

    for (const label of [
      'أعارض بشدة',
      'أعارض',
      'محايد',
      'أوافق',
      'أوافق بشدة',
    ]) {
      expect(view.getByText(label)).toBeTruthy();
    }
    expect(view.getByLabelText('أعارض بشدة -2')).toBeTruthy();
    expect(view.getByLabelText('محايد 0')).toBeTruthy();
  });

  test('orders the answer row right to left in Arabic', async () => {
    const view = await renderApp();

    const row = view.getByTestId('compass-answers');
    expect(StyleSheet.flatten(row.props.style)?.flexDirection).toBe(
      'row-reverse',
    );
  });

  test('captures the result card and hands it to the share sheet', async () => {
    const view = await renderApp();
    await answerEveryQuestion(view);

    expect(view.getByText('نتائج بوصلة سوريا')).toBeTruthy();
    await fireEvent.press(view.getByText('مشاركة النتيجة'));

    await waitFor(() =>
      expect(view.getByText('تم تجهيز صورة النتيجة وفتح خيارات المشاركة.')).toBeTruthy(),
    );
    expect(captureRef).toHaveBeenCalledWith(expect.anything(), {
      format: 'jpg',
      quality: 0.9,
      result: 'tmpfile',
    });
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      'file:///tmp/compass-results.jpg',
      { mimeType: 'image/jpeg', UTI: 'public.jpeg' },
    );
  });
});
