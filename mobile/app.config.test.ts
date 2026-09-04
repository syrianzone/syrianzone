import type { ConfigContext } from 'expo/config';

import createAppConfig from './app.config';

jest.mock('./plugins/withDataChannelWebRtc.js', () => ({
  withDataChannelWebRtc: (config: unknown) => config,
}));

function appConfig() {
  return createAppConfig({
    config: {
      name: 'fixture',
      slug: 'fixture',
    },
  } as ConfigContext);
}

test('registers one stable native auth scheme', () => {
  expect(appConfig().scheme).toBe('syrianzone');
});

test('declares deterministic native build identities', () => {
  const config = appConfig();

  expect(config.ios?.buildNumber).toBe('1');
  expect(config.android?.versionCode).toBe(1);
});

test('blocks the unused Android system overlay permission', () => {
  expect(appConfig().android?.blockedPermissions).toContain(
    'android.permission.SYSTEM_ALERT_WINDOW',
  );
});

test('configures local notification icon, tint, and default channel', () => {
  expect(appConfig().plugins).toContainEqual([
    'expo-notifications',
    {
      color: '#5a714a',
      defaultChannel: 'updates',
      icon: './assets/images/icon-monochrome.png',
    },
  ]);
});

test('enables iOS background processing for notification checks', () => {
  expect(appConfig().plugins).toContain('expo-background-task');
});
