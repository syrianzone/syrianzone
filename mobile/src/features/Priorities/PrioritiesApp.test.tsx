import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import { cloneTopics, encodePriorityState, setTopicPoints } from './model';
import PrioritiesApp from './PrioritiesApp';

let mockSharedState: string | undefined;

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ state: mockSharedState }),
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(async () => true),
}));

async function renderApp() {
  return render(
    <LocaleProvider>
      <AppThemeProvider>
        <PrioritiesApp />
      </AppThemeProvider>
    </LocaleProvider>,
  );
}

describe('native priorities workspace', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockSharedState = undefined;
    jest.mocked(Clipboard.setStringAsync).mockClear();
  });

  test('loads a shared profile and changes allocations one point at a time', async () => {
    let topics = setTopicPoints(cloneTopics(), 'economy', 60);
    topics = setTopicPoints(topics, 'justice', 40);
    mockSharedState = encodePriorityState(topics, new Set(['salaries']));
    const view = await renderApp();

    expect(view.getByText('0 / 100')).toBeTruthy();
    expect(view.getByText('60%')).toBeTruthy();
    await fireEvent.press(
      view.getByLabelText('تقليل الملف الاقتصادي ومعالجة الفساد نقطة واحدة'),
    );
    expect(view.getByText('59%')).toBeTruthy();
    expect(view.getByText('1 / 100')).toBeTruthy();
  });

  test('copies the source-compatible summary and opens story design', async () => {
    let topics = setTopicPoints(cloneTopics(), 'economy', 60);
    topics = setTopicPoints(topics, 'justice', 40);
    mockSharedState = encodePriorityState(topics, new Set(['salaries']));
    const view = await renderApp();

    await fireEvent.press(view.getByText('نسخ ملخص الأولويات'));
    await waitFor(() =>
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
        expect.stringContaining('ترتيب الأولويات الثلاث الكبرى'),
      ),
    );

    await fireEvent.press(view.getByText('تصميم صورة ستوري'));
    expect(view.getByText('بطاقة القصة')).toBeTruthy();
  });

  test('persists the education banner dismissal', async () => {
    const first = await renderApp();
    await fireEvent.press(first.getByText('فهمت، إخفاء المقدمة'));
    await waitFor(() =>
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'sz-priorities-banner-dismissed',
        'true',
      ),
    );
    await first.unmount();

    const second = await renderApp();
    await waitFor(() =>
      expect(
        second.queryByText('أثر القرارات المتداخلة ومحدودية الموارد'),
      ).toBeNull(),
    );
  });
});
