import { LogManager } from '@maplibre/maplibre-react-native';
import { Platform } from 'react-native';

interface MapLibreLogManager {
  setLogLevel(level: 'none'): void;
}

export function createMapLibreLoggingInitializer() {
  let initialized = false;

  return (platform: string, logManager: MapLibreLogManager) => {
    if (platform !== 'ios' || initialized) {
      return;
    }

    logManager.setLogLevel('none');
    initialized = true;
  };
}

const initializeMapLibreLogging = createMapLibreLoggingInitializer();

export function configureMapLibreLogging() {
  initializeMapLibreLogging(
    Platform.OS,
    LogManager as unknown as MapLibreLogManager,
  );
}
