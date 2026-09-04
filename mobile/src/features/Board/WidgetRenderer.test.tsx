import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import { boardSources } from './sources';
import { WidgetRenderer } from './WidgetRenderer';
import { WIDGETS } from './registry';
import type { WidgetInstance } from './types';

jest.mock('./sources', () => ({
  boardSources: {
    answers: jest.fn(async () => []),
    eventsToday: jest.fn(async () => ({
      events: [],
      governorate: 'damascus',
      is_fallback: false,
    })),
    feed: jest.fn(async () => ({ items: [], source: 'jard', title: 'الأخبار' })),
    prayerTimes: jest.fn(async () => ({
      governorate: 'damascus',
      hijri: null,
      timings: { Asr: '15:30', Dhuhr: '12:00', Fajr: '05:00', Isha: '20:00', Maghrib: '18:30' },
    })),
    recipeOfTheDay: jest.fn(async () => ({
      city: null,
      difficulty: null,
      id: 1,
      image_url: null,
      name: 'فتة',
      tags: [],
      time_needed: [],
      url: 'https://food.syrian.zone/recipes/1',
    })),
    weather: jest.fn(async () => ({
      description: 'clear sky',
      forecast: [],
      governorate: 'damascus',
      icon: '01d',
      temp: 28,
    })),
  },
}));

jest.mock('@/features/Places/_lib/api', () => ({
  placesApi: {
    guides: jest.fn(async (sort: string) => ({ guides: [], sort })),
    nearby: jest.fn(async () => ({ places: [] })),
  },
}));

jest.mock('@/features/Transit/api', () => ({
  getCities: jest.fn(async () => []),
}));

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  PermissionStatus: { GRANTED: 'granted' },
  getCurrentPositionAsync: jest.fn(async () => ({
    coords: { latitude: 33.5, longitude: 36.2 },
  })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({
    granted: true,
    status: 'granted',
  })),
}));

async function renderWidget(
  definitionId: string,
  config: Record<string, unknown> = {},
  onConfigChange = jest.fn(),
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });
  const instance: WidgetInstance = {
    c: config,
    d: definitionId,
    h: 3,
    i: `w_${definitionId}`,
    w: 6,
  };
  const view = await render(
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <AppThemeProvider>
          <WidgetRenderer
            instance={instance}
            onConfigChange={onConfigChange}
          />
        </AppThemeProvider>
      </LocaleProvider>
    </QueryClientProvider>,
  );
  return { onConfigChange, view };
}

test('renders all thirteen registered widget bodies', async () => {
  for (const definition of WIDGETS) {
    const { view } = await renderWidget(
      definition.id,
      Object.fromEntries(
        definition.fields.map((field) => [field.key, field.default]),
      ),
    );
    expect(view.getByText(definition.nameAr)).toBeTruthy();
    await view.unmount();
  }
});

test('renders unknown widgets without dropping their definition id', async () => {
  const { view } = await renderWidget('future-widget');

  expect(view.getByText('ويدجت غير معروف')).toBeTruthy();
  expect(view.getByText('future-widget')).toBeTruthy();
});

test('edits note text and todo items through the document config callback', async () => {
  jest.useFakeTimers();
  const noteChange = jest.fn();
  const note = await renderWidget('notes', { text: '' }, noteChange);
  await fireEvent.changeText(note.view.getByTestId('board-notes-input'), 'ملاحظة');
  jest.advanceTimersByTime(400);
  expect(noteChange).toHaveBeenCalledWith({ text: 'ملاحظة' });
  await note.view.unmount();

  const todoChange = jest.fn();
  const todo = await renderWidget(
    'todo',
    { hideCompleted: false, items: [] },
    todoChange,
  );
  await fireEvent.changeText(todo.view.getByTestId('board-todo-input'), 'مهمة');
  await fireEvent.press(todo.view.getByLabelText('إضافة مهمة'));
  expect(todoChange).toHaveBeenCalledWith({
    items: [expect.objectContaining({ done: false, text: 'مهمة' })],
  });
  jest.useRealTimers();
});

test('starts, pauses, and resets the local pomodoro without writing timer state', async () => {
  jest.useFakeTimers();
  const change = jest.fn();
  const { view } = await renderWidget('pomodoro', { rest: 5, work: 25 }, change);

  await fireEvent.press(view.getByText('ابدأ'));
  await act(async () => {
    jest.advanceTimersByTime(1_000);
  });
  await waitFor(() => expect(view.getByTestId('board-pomodoro-time').props.children).not.toBe('25:00'));
  await fireEvent.press(view.getByText('إيقاف مؤقت'));
  await fireEvent.press(view.getByLabelText('إعادة ضبط'));
  expect(view.getByTestId('board-pomodoro-time').props.children).toBe('25:00');
  expect(change).not.toHaveBeenCalled();
  jest.useRealTimers();
});

test('renders the weather condition in Arabic with weekday forecast labels', async () => {
  jest.mocked(boardSources.weather).mockResolvedValueOnce({
    description: 'clear sky',
    forecast: [
      { code: 0, date: '2026-07-24', max: 34, min: 21 },
      { code: 61, date: '2026-07-25', max: 33, min: 20 },
    ],
    governorate: 'damascus',
    icon: '01d',
    temp: 28,
  });
  const { view } = await renderWidget('weather', { governorate: 'damascus' });

  await waitFor(() =>
    expect(view.getByText('دمشق · سماء صافية')).toBeTruthy(),
  );
  expect(view.getByText('اليوم · 34° / 21° · صافية')).toBeTruthy();
  expect(view.getByText('السبت · 33° / 20° · مطر خفيف')).toBeTruthy();
});

test('shows venue, price, category, and the all-day fallback for today events', async () => {
  jest.mocked(boardSources.eventsToday).mockResolvedValueOnce({
    events: [
      {
        address: 'دار الأوبرا',
        category: 'موسيقى',
        event_date: '2026-07-24',
        event_time: '19:30:00',
        id: '1',
        is_free: false,
        is_online: false,
        name: 'حفل موسيقي',
        organizer: null,
        ticket_price: 5_000,
        url: 'https://f3alia.com/events/1',
      },
      {
        address: '',
        category: null,
        event_date: '2026-07-24',
        event_time: null,
        id: '2',
        is_free: true,
        is_online: true,
        name: 'ورشة تصميم',
        organizer: null,
        ticket_price: null,
        url: 'https://f3alia.com/events/2',
      },
    ],
    governorate: 'damascus',
    is_fallback: false,
  });
  const { view } = await renderWidget('events-today', {
    governorate: 'damascus',
  });

  await waitFor(() => expect(view.getByText('حفل موسيقي')).toBeTruthy());
  expect(view.getByText('19:30')).toBeTruthy();
  expect(view.getByText('دار الأوبرا')).toBeTruthy();
  expect(view.getByText('5,000 ل.س · موسيقى')).toBeTruthy();
  expect(view.getByText('طوال اليوم')).toBeTruthy();
  expect(view.getByText('عبر الإنترنت')).toBeTruthy();
  expect(view.getByText('مجاني')).toBeTruthy();
});
