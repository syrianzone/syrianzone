import { createMapLibreLoggingInitializer } from './logging';

jest.mock('@maplibre/maplibre-react-native', () => ({
  LogManager: {
    setLogLevel: jest.fn(),
  },
}));

function createLogManager() {
  return {
    setLogLevel: jest.fn(),
  };
}

test('disables MapLibre Native logging on iOS', () => {
  const initialize = createMapLibreLoggingInitializer();
  const logManager = createLogManager();

  initialize('ios', logManager);

  expect(logManager.setLogLevel).toHaveBeenCalledWith('none');
});

test('leaves MapLibre Native logging unchanged on Android', () => {
  const initialize = createMapLibreLoggingInitializer();
  const logManager = createLogManager();

  initialize('android', logManager);

  expect(logManager.setLogLevel).not.toHaveBeenCalled();
});

test('disables MapLibre Native logging only once', () => {
  const initialize = createMapLibreLoggingInitializer();
  const logManager = createLogManager();

  initialize('ios', logManager);
  initialize('ios', logManager);

  expect(logManager.setLogLevel).toHaveBeenCalledTimes(1);
});
