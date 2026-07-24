const {
  AndroidConfig,
  withDangerousMod,
  withPodfile,
  withProjectBuildGradle,
} = require('expo/config-plugins');
const { promises: fs } = require('node:fs');
const path = require('node:path');

const keepRules = [
  '-keep class com.oney.WebRTCModule.** { *; }',
  '-keep class org.webrtc.** { *; }',
].join('\n');

const androidPinMarker = '// Syrian Zone pinned WebRTC dependencies';
const iosPin = "  pod 'JitsiWebRTC', '124.0.2'";

function mergeAndroidPins(source) {
  if (source.includes(androidPinMarker)) {
    return source;
  }
  const separator = source.endsWith('\n') ? '' : '\n';
  return `${source}${separator}\n${androidPinMarker}\nallprojects {\n  configurations.all {\n    resolutionStrategy {\n      force 'org.jitsi:webrtc:124.0.0'\n      force 'com.facebook.react:react-android:0.86.0'\n    }\n  }\n}\n`;
}

function mergeIosPin(source) {
  if (source.includes(iosPin)) {
    return source;
  }
  const target = /^(target ['"][^'"]+['"] do\n)/m;
  if (!target.test(source)) {
    throw new Error('Unable to find the iOS application target for the WebRTC pin.');
  }
  return source.replace(target, `$1${iosPin}\n`);
}

function mergeKeepRules(source) {
  if (source.includes('-keep class com.oney.WebRTCModule.**')) {
    return source;
  }

  const separator = source.endsWith('\n') || source.length === 0 ? '' : '\n';
  return `${source}${separator}\n# Data-only Guess Who WebRTC\n${keepRules}\n`;
}

const withReleaseKeepRules = (config) =>
  withDangerousMod(config, [
    'android',
    async (androidConfig) => {
      const rulesPath = path.join(
        androidConfig.modRequest.platformProjectRoot,
        'app',
        'proguard-rules.pro',
      );
      const source = await fs.readFile(rulesPath, 'utf8');
      await fs.writeFile(rulesPath, mergeKeepRules(source), 'utf8');
      return androidConfig;
    },
  ]);

const withPinnedAndroidDependencies = (config) =>
  withProjectBuildGradle(config, (androidConfig) => {
    androidConfig.modResults.contents = mergeAndroidPins(
      androidConfig.modResults.contents,
    );
    return androidConfig;
  });

const withPinnedIosDependency = (config) =>
  withPodfile(config, (iosConfig) => {
    iosConfig.modResults.contents = mergeIosPin(iosConfig.modResults.contents);
    return iosConfig;
  });

const withDataChannelWebRtc = (config) => {
  const withPermissions = AndroidConfig.Permissions.withPermissions(config, [
    'android.permission.ACCESS_NETWORK_STATE',
    'android.permission.CHANGE_NETWORK_STATE',
    'android.permission.INTERNET',
  ]);

  return withPinnedIosDependency(
    withPinnedAndroidDependencies(withReleaseKeepRules(withPermissions)),
  );
};

module.exports = {
  mergeAndroidPins,
  mergeIosPin,
  mergeKeepRules,
  withDataChannelWebRtc,
};
