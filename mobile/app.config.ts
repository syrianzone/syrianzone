import type { ConfigContext, ExpoConfig } from 'expo/config';

import { withDataChannelWebRtc } from './plugins/withDataChannelWebRtc.js';

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
      bundleIdentifier: 'zone.syrian.app',
      supportsTablet: true,
      icon: './assets/images/icon.png',
      config: {
        usesNonExemptEncryption: false,
      },
    },
    android: {
      package: 'zone.syrian.app',
      adaptiveIcon: {
        backgroundColor: '#f6f4ed',
        foregroundImage: './assets/images/icon.png',
        monochromeImage: './assets/images/icon-monochrome.png',
      },
      predictiveBackGestureEnabled: true,
    },
    web: {
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
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
