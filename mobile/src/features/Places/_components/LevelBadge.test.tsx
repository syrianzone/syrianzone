import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import {
  GUIDE_LEVELS,
  LevelBadge,
  nextRank,
  rankName,
} from './LevelBadge';

function wrap(children: React.ReactNode) {
  return (
    <LocaleProvider>
      <AppThemeProvider>{children}</AppThemeProvider>
    </LocaleProvider>
  );
}

test('keeps the exact ten Mishwar thresholds and Arabic rank names', () => {
  expect(GUIDE_LEVELS).toEqual([
    { level: 1, points: 0 },
    { level: 2, points: 15 },
    { level: 3, points: 75 },
    { level: 4, points: 250 },
    { level: 5, points: 500 },
    { level: 6, points: 1500 },
    { level: 7, points: 5000 },
    { level: 8, points: 15000 },
    { level: 9, points: 50000 },
    { level: 10, points: 100000 },
  ]);
  expect(Array.from({ length: 10 }, (_, index) => rankName(index + 1))).toEqual([
    'مبتدئ',
    'جوّال',
    'مستطلع',
    'مستكشف',
    'مرشد محلي',
    'مرشد خبير',
    'رحّالة',
    'رائد السياحة',
    'سفير السياحة',
    'وزير السياحة',
  ]);
  expect(rankName(-4)).toBe('مبتدئ');
  expect(rankName(99)).toBe('وزير السياحة');
});

test('finds the next rank boundary and stops at the top rank', () => {
  expect(nextRank(14)).toEqual({ level: 2, points: 15 });
  expect(nextRank(15)).toEqual({ level: 3, points: 75 });
  expect(nextRank(99999)).toEqual({ level: 10, points: 100000 });
  expect(nextRank(100000)).toBeNull();
});

test('labels a valid guide badge with its named rank', async () => {
  const view = await render(wrap(<LevelBadge level={6} showLabel />));

  expect(view.getByLabelText('مرشد خبير، المستوى 6')).toBeTruthy();
  expect(view.getByText('مرشد خبير')).toBeTruthy();
});

test('uses the exact gold and premium tier colors from Mishwar', async () => {
  const view = await render(wrap(
    <>
      <LevelBadge level={6} />
      <LevelBadge level={8} />
    </>,
  ));

  expect(StyleSheet.flatten(view.getByLabelText('مرشد خبير، المستوى 6').props.style)).toMatchObject({
    backgroundColor: 'rgba(230, 155, 25, 0.12)',
    borderColor: 'rgba(230, 155, 25, 0.4)',
  });
  expect(StyleSheet.flatten(view.getByLabelText('رائد السياحة، المستوى 8').props.style)).toMatchObject({
    backgroundColor: 'rgba(221, 75, 124, 0.12)',
    borderColor: 'rgba(221, 75, 124, 0.4)',
  });
});

test('does not render invalid guide levels', async () => {
  const view = await render(wrap(<LevelBadge level={0} showLabel />));

  expect(view.toJSON()).toBeNull();
});
