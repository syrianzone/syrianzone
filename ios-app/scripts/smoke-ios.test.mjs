import { expect, test } from 'bun:test';
import { isAppRunning } from './smoke-ios.mjs';

test('requires the launched PID and exact app label rather than a stale launchd entry', () => {
  const label = 'UIKitApplication:zone.syrian.ios[123][rb-456]';
  expect(isAppRunning(`812\t0\t${label}`, 812, 'zone.syrian.ios')).toBe(true);
  expect(isAppRunning(`-\t6\t${label}`, 812, 'zone.syrian.ios')).toBe(false);
  expect(isAppRunning(`999\t0\t${label}`, 812, 'zone.syrian.ios')).toBe(false);
  expect(isAppRunning('812\t0\tUIKitApplication:zone.syrian.other[123]', 812, 'zone.syrian.ios')).toBe(false);
});
