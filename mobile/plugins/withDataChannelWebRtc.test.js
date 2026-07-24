const assert = require('node:assert/strict');
const test = require('node:test');

const {
  mergeAndroidPins,
  mergeIosPin,
} = require('./withDataChannelWebRtc');

test('pins Android WebRTC and React Native artifacts once', () => {
  const source = 'allprojects {\n  repositories { google() }\n}\n';
  const first = mergeAndroidPins(source);
  const second = mergeAndroidPins(first);

  assert.match(first, /org\.jitsi:webrtc:124\.0\.0/);
  assert.match(first, /com\.facebook\.react:react-android:0\.86\.0/);
  assert.equal(second, first);
});

test('pins the iOS WebRTC pod inside the application target once', () => {
  const source = "target 'SyrianZone' do\n  use_expo_modules!\nend\n";
  const first = mergeIosPin(source);
  const second = mergeIosPin(first);

  assert.match(first, /pod 'JitsiWebRTC', '124\.0\.2'/);
  assert.equal(second, first);
});
