import type { ExpoConfig } from 'expo/config';

// React Native, Expo, and native SwiftUI controls follow pingdotgg/t3code's mobile stack.
const config: ExpoConfig = {
  name: 'Syrian Zone',
  slug: 'syrianzone-ios',
  version: '0.1.0',
  icon: '../public/icons/icon-512.png',
  scheme: ['syrianzone', 'zone.syrian.ios'],
  platforms: ['ios'],
  orientation: 'default',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'zone.syrian.ios',
    supportsTablet: true,
    requireFullScreen: false,
    infoPlist: {
      CFBundleDevelopmentRegion: 'ar',
      CFBundleLocalizations: ['ar', 'en'],
      ITSAppUsesNonExemptEncryption: false,
      UIViewControllerBasedStatusBarAppearance: true,
      UIBackgroundModes: ['audio'],
      NSLocationWhenInUseUsageDescription: 'نستخدم موقعك لعرض الأماكن ومحطات النقل القريبة منك.',
      UISupportedInterfaceOrientations: [
        'UIInterfaceOrientationPortrait',
        'UIInterfaceOrientationPortraitUpsideDown',
        'UIInterfaceOrientationLandscapeLeft',
        'UIInterfaceOrientationLandscapeRight'
      ],
      'UISupportedInterfaceOrientations~ipad': [
        'UIInterfaceOrientationPortrait',
        'UIInterfaceOrientationPortraitUpsideDown',
        'UIInterfaceOrientationLandscapeLeft',
        'UIInterfaceOrientationLandscapeRight'
      ]
    }
  },
  plugins: [
    'expo-sqlite',
    'expo-secure-store',
    'expo-font',
    'expo-web-browser',
    'expo-sharing',
    ['expo-image-picker', { photosPermission: 'اختر صورة لحسابك.', cameraPermission: false, microphonePermission: false }],
    ['expo-localization', { supportsRTL: true, forcesRTL: true, supportedLocales: { ios: ['ar'] } }],
    ['expo-location', { locationWhenInUsePermission: 'نستخدم موقعك لعرض الأماكن ومحطات النقل القريبة منك.' }],
    ['expo-build-properties', { ios: { deploymentTarget: '18.0', buildReactNativeFromSource: true } }]
  ],
  experiments: { reactCompiler: true }
};

export default config;
