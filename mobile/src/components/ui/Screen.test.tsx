import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import { AppText } from './AppText';
import { Screen } from './Screen';

function wrapper(onEndReached: () => void) {
  return (
    <LocaleProvider>
      <AppThemeProvider>
        <Screen onEndReached={onEndReached}>
          <AppText>content</AppText>
        </Screen>
      </AppThemeProvider>
    </LocaleProvider>
  );
}

test('notifies once when a scroll reaches the end threshold', async () => {
  const onEndReached = jest.fn();
  const view = await render(wrapper(onEndReached));
  const scroll = view.getByTestId('screen-scroll');

  await fireEvent.scroll(scroll, {
    nativeEvent: {
      contentOffset: { y: 100 },
      contentSize: { height: 1000 },
      layoutMeasurement: { height: 500 },
    },
  });
  expect(onEndReached).not.toHaveBeenCalled();

  const endEvent = {
    nativeEvent: {
      contentOffset: { y: 420 },
      contentSize: { height: 1000 },
      layoutMeasurement: { height: 500 },
    },
  };
  await fireEvent.scroll(scroll, endEvent);
  await fireEvent.scroll(scroll, endEvent);

  expect(onEndReached).toHaveBeenCalledTimes(1);
});

test('can notify again after the user scrolls away from the end', async () => {
  const onEndReached = jest.fn();
  const view = await render(wrapper(onEndReached));
  const scroll = view.getByTestId('screen-scroll');
  const event = (y: number) => ({
    nativeEvent: {
      contentOffset: { y },
      contentSize: { height: 1000 },
      layoutMeasurement: { height: 500 },
    },
  });

  await fireEvent.scroll(scroll, event(420));
  await fireEvent.scroll(scroll, event(100));
  await fireEvent.scroll(scroll, event(420));

  expect(onEndReached).toHaveBeenCalledTimes(2);
});

test('fills the safe area when scrolling is disabled', async () => {
  const view = await render(
    <LocaleProvider>
      <AppThemeProvider>
        <Screen scroll={false}>
          <AppText>content</AppText>
        </Screen>
      </AppThemeProvider>
    </LocaleProvider>,
  );

  expect(
    StyleSheet.flatten(view.getByTestId('screen-content').props.style),
  ).toMatchObject({ flex: 1 });
});
