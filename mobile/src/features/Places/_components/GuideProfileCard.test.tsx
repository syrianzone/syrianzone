import { fireEvent, render } from '@testing-library/react-native';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import type { Guide } from '../_lib/types';
import { GuideProfileCard } from './GuideProfileCard';

const guide: Guide = {
  approved_count: 8,
  avatar_url: null,
  level: 5,
  name: 'ليلى',
  points: 520,
  rank: 1,
  recent_count: 3,
  saves_total: 31,
  user_id: 5,
};

async function renderProfile(overrides: Partial<Guide> = {}) {
  const onClose = jest.fn();
  const onShowContributions = jest.fn();
  const view = await render(
    <LocaleProvider>
      <AppThemeProvider>
        <GuideProfileCard
          guide={{ ...guide, ...overrides }}
          onClose={onClose}
          onShowContributions={onShowContributions}
        />
      </AppThemeProvider>
    </LocaleProvider>,
  );
  return { onClose, onShowContributions, view };
}

test('shows points, contribution counts, and progress to the next rank', async () => {
  const { view } = await renderProfile();

  expect(view.getByText('520')).toBeTruthy();
  expect(view.getByText('8')).toBeTruthy();
  expect(view.getByText('31')).toBeTruthy();
  expect(view.getByText('3')).toBeTruthy();
  expect(view.getByText('مرشد خبير عند 1500')).toBeTruthy();
  expect(view.getByTestId('guide-progress').props.accessibilityValue).toEqual({
    max: 100,
    min: 0,
    now: 35,
  });
});

test('selects the guide contributions and closes from either action', async () => {
  const { onClose, onShowContributions, view } = await renderProfile();

  await fireEvent.press(view.getByText('عرض المساهمات على الخريطة'));
  expect(onShowContributions).toHaveBeenCalledWith({ id: 5, name: 'ليلى' });

  await fireEvent.press(view.getByLabelText('إغلاق ملف المرشد'));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('recognizes the top rank without showing another threshold', async () => {
  const { view } = await renderProfile({ level: 10, points: 100000 });

  expect(view.getByText('أعلى رتبة، وزير السياحة')).toBeTruthy();
  expect(view.queryByTestId('guide-progress')).toBeNull();
});
