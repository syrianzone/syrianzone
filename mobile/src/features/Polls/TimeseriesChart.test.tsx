import { render, waitFor } from '@testing-library/react-native';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';

import { captureColors } from '@/components/poll/MonthlyLineChart';
import { AppText } from '@/components/ui/AppText';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider, useAppTheme } from '@/contexts/ThemeContext';
import type { PollHistory, PollRanking } from '@/lib/api/polls';
import { getThemeById } from '@/lib/ported/theme';
import {
  preferenceKeys,
  writeStringPreference,
} from '@/lib/storage/preferences';

import { TimeseriesChart } from './TimeseriesChart';

const rankings: PollRanking[] = [
  {
    archiveReason: null,
    avg: 2.5,
    candidateId: 'candidate-1',
    category: 'minister',
    groupId: 'ministers',
    imageUrl: null,
    name: 'الأول',
    rank: 1,
    score: 40,
    status: 'active',
    successorId: null,
    termEndedAt: null,
    termStartedAt: null,
    title: null,
    votes: 16,
  },
];
const history: PollHistory = {
  'candidate-1': [{ date: '2026-01-02', score: 40, votes: 16 }],
};

function ActiveThemeProbe() {
  const { theme } = useAppTheme();
  return <AppText>active:{theme.id}</AppText>;
}

function colorOf(element: {
  props: { style?: StyleProp<TextStyle> };
}): TextStyle['color'] {
  return StyleSheet.flatten(element.props.style).color;
}

test('draws the shared chart image with fixed dark text in a dark theme', async () => {
  await writeStringPreference(preferenceKeys.theme, 'dark');
  const view = await render(
    <LocaleProvider>
      <AppThemeProvider>
        <TimeseriesChart
          candidates={rankings}
          history={history}
          title="تقدم الوزراء"
        />
        <ActiveThemeProbe />
      </AppThemeProvider>
    </LocaleProvider>,
  );
  await waitFor(() => expect(view.getByText('active:dark')).toBeTruthy());

  const themeForeground = getThemeById('dark')?.palette.foreground;
  expect(colorOf(view.getByText('تقدم الوزراء'))).toBe(captureColors.foreground);
  expect(colorOf(view.getByText('تقدم الوزراء'))).not.toBe(themeForeground);
  expect(colorOf(view.getByText('تطوّر النقاط الشهري'))).toBe(
    captureColors.foreground,
  );
  expect(colorOf(view.getByText('تقدم المرشحين عبر الزمن'))).toBe(
    captureColors.mutedForeground,
  );
});
