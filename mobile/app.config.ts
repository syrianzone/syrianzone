import type { ConfigContext, ExpoConfig } from 'expo/config';

import { withDataChannelWebRtc } from './plugins/withDataChannelWebRtc.js';

// syrian.zone pages that have a native screen. Duplicated from
// src/lib/linking.ts because the Expo config is evaluated in plain Node, where
// importing app code would pull in native modules; app.config.test.ts fails if
// the two lists drift. Exact paths only: a catch-all prefix would claim website
// pages the app cannot render and drop the user on an unmatched route.
export const websiteAppLinkPaths: readonly string[] = [
  '/',
  '/about',
  '/alignment',
  '/board',
  '/compass',
  '/dashboard',
  '/govapps',
  '/guesswho',
  '/house',
  '/justice',
  '/mishwar',
  '/party',
  '/phonebook',
  '/polls',
  '/population',
  '/priorities',
  '/privacy',
  '/roznama',
  '/shawarma',
  '/sites',
  '/syid',
  '/syofficial',
  '/syrian-contributors',
  '/terms',
  '/tierlist',
  '/transit',
  '/transit/admin',
  '/transit/studio',
];

// Transit city pages carry an id, so they need a prefix rather than a path.
export const websiteAppLinkPathPrefixes: readonly string[] = ['/transit/city/'];

export default ({ config }: ConfigContext): ExpoConfig => {
  const appConfig: ExpoConfig = {
    ...config,
    name: 'Syrian Zone',
    slug: 'syrianzone',
    version: '1.0.0',
    orientation: 'default',
    icon: './assets/images/icon.png',
    scheme: 'syrianzone',
    userInterfaceStyle: 'automatic',
    ios: {
      // No associatedDomains yet: iOS universal links need
      // https://syrian.zone/.well-known/apple-app-site-association carrying the
      // Apple team id and the Associated Domains capability on the provisioning
      // profile, both of which only the maintainer can issue. Until then
      // syrian.zone links open in Safari on iOS.
      buildNumber: '1',
      bundleIdentifier: 'zone.syrian.app',
      supportsTablet: true,
      icon: './assets/images/icon.png',
      config: {
        usesNonExemptEncryption: false,
      },
    },
    android: {
      versionCode: 1,
      package: 'zone.syrian.app',
      blockedPermissions: ['android.permission.SYSTEM_ALERT_WINDOW'],
      adaptiveIcon: {
        backgroundColor: '#f6f4ed',
        foregroundImage: './assets/images/icon.png',
        monochromeImage: './assets/images/icon-monochrome.png',
      },
      predictiveBackGestureEnabled: true,
      intentFilters: [
        {
          action: 'VIEW',
          // autoVerify stays false until the maintainer publishes the release
          // signing certificate SHA-256 fingerprint in
          // https://syrian.zone/.well-known/assetlinks.json. Android only
          // verifies an app link against that file; with autoVerify true and no
          // file, Android 12 and later sends every one of these links straight
          // to the browser and never offers the app. With false the app still
          // appears in the "open with" chooser, which is the honest behaviour
          // until the fingerprint is published.
          autoVerify: false,
          category: ['BROWSABLE', 'DEFAULT'],
          data: [
            ...websiteAppLinkPaths.map((path) => ({
              host: 'syrian.zone',
              path,
              scheme: 'https',
            })),
            ...websiteAppLinkPathPrefixes.map((pathPrefix) => ({
              host: 'syrian.zone',
              pathPrefix,
              scheme: 'https',
            })),
          ],
        },
      ],
    },
    web: {
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      'expo-background-task',
      [
        'expo-notifications',
        {
          color: '#5a714a',
          defaultChannel: 'updates',
          icon: './assets/images/icon-monochrome.png',
        },
      ],
      '@maplibre/maplibre-react-native',
      [
        'expo-secure-store',
        {
          configureAndroidBackup: true,
        },
      ],
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'تستخدم المساحة السورية موقعك عند طلب الطقس أو مواقيت الصلاة المحلية أو الأماكن أو محطات النقل القريبة.',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission:
            'تحتاج المساحة السورية إلى الصور التي تختارها لإرسال مساهمتك.',
          cameraPermission: false,
          microphonePermission: false,
        },
      ],
      'expo-localization',
      'expo-sharing',
      'expo-web-browser',
      [
        'expo-splash-screen',
        {
          backgroundColor: '#f6f4ed',
          image: './assets/images/splash-icon.png',
          imageWidth: 128,
          dark: {
            backgroundColor: '#111611',
            image: './assets/images/splash-icon.png',
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      supportsRTL: true,
    },
  };

  return withDataChannelWebRtc(appConfig);
};
