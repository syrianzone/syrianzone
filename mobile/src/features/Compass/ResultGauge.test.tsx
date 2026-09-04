import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import { SCALES } from './data';
import { ResultGauge } from './ResultGauge';

const scale = SCALES[0]!;

async function renderGauge(value: number) {
  return render(
    <LocaleProvider>
      <AppThemeProvider>
        <ResultGauge scale={scale} value={value} />
      </AppThemeProvider>
    </LocaleProvider>,
  );
}

type Gauge = Awaited<ReturnType<typeof renderGauge>>;

function rowDirection(view: Gauge): string {
  const row = view.getByTestId(`compass-poles-${scale.id}`);
  return String(StyleSheet.flatten(row.props.style)?.flexDirection);
}

// The gauge renders the left pole first, so a reversed row puts that pole on
// the physical right, which is the side a marker offset above 50% lands on.
function poleUnderMarker(view: Gauge): string {
  const marker = view.getByTestId(`compass-marker-${scale.id}`);
  const offset = Number.parseFloat(
    String(StyleSheet.flatten(marker.props.style)?.left),
  );
  const physical =
    rowDirection(view) === 'row-reverse'
      ? [scale.right, scale.left]
      : [scale.left, scale.right];
  return offset >= 50 ? physical[1]! : physical[0]!;
}

describe('compass result gauge', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('lands the marker under the left pole when the score maxes out', async () => {
    const view = await renderGauge(1);

    expect(view.getByText(`${scale.left} جداً`)).toBeTruthy();
    expect(poleUnderMarker(view)).toBe(scale.left);
  });

  test('lands the marker under the right pole when the score bottoms out', async () => {
    const view = await renderGauge(-1);

    expect(view.getByText(`${scale.right} جداً`)).toBeTruthy();
    expect(poleUnderMarker(view)).toBe(scale.right);
  });

  test('mirrors the marker offset when the app runs left to right', async () => {
    await AsyncStorage.setItem('sz-locale', 'en');
    const view = await renderGauge(1);

    await waitFor(() => expect(rowDirection(view)).toBe('row'));
    expect(poleUnderMarker(view)).toBe(scale.left);
    expect(
      StyleSheet.flatten(
        view.getByTestId(`compass-marker-${scale.id}`).props.style,
      )?.left,
    ).toBe('0%');
  });

  test('prints the percentage readout the web results show', async () => {
    const view = await renderGauge(0);

    expect(view.getByText('نسبة 50%')).toBeTruthy();
    expect(view.getByText('محايد')).toBeTruthy();
  });
});
