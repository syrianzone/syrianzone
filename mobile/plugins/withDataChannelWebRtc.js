const { AndroidConfig, withDangerousMod } = require('expo/config-plugins');
const { promises: fs } = require('node:fs');
const path = require('node:path');

const keepRules = [
  '-keep class com.oney.WebRTCModule.** { *; }',
  '-keep class org.webrtc.** { *; }',
].join('\n');

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

const withDataChannelWebRtc = (config) => {
  const withPermissions = AndroidConfig.Permissions.withPermissions(config, [
    'android.permission.ACCESS_NETWORK_STATE',
    'android.permission.CHANGE_NETWORK_STATE',
    'android.permission.INTERNET',
  ]);

  return withReleaseKeepRules(withPermissions);
};

module.exports = { mergeKeepRules, withDataChannelWebRtc };
