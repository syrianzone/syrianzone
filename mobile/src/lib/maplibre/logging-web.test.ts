jest.mock('@maplibre/maplibre-react-native', () => {
  throw new Error('The web logging boundary loaded native MapLibre code.');
});

test('keeps the web logging initializer native-module free', () => {
  const { configureMapLibreLogging } = jest.requireActual('./logging.web');

  expect(() => configureMapLibreLogging()).not.toThrow();
});
