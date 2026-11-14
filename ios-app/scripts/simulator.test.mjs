import { expect, test } from 'bun:test';
import { assertSdkSupport, reportBootStatus, selectSimulator } from './simulator.mjs';

const inventory = {
  runtimes: [{ identifier: 'ios-27-2', name: 'iOS 27.2', version: '27.2', isAvailable: true }],
  devicetypes: [{ identifier: 'duo', name: 'iPhone Duo' }, { identifier: 'ipad', name: 'iPad Pro 13-inch (M5)' }],
  devices: { 'ios-27-2': [{ name: 'My Duo', udid: 'existing-duo', deviceTypeIdentifier: 'duo', isAvailable: true, state: 'Shutdown' }] }
};

test('selects a real Duo profile and existing device on SDK 27.1 or later', () => {
  expect(selectSimulator(inventory).device?.udid).toBe('existing-duo');
  expect(selectSimulator(inventory).type.identifier).toBe('duo');
});

test('refuses to substitute a conventional phone for Duo', () => {
  expect(() => selectSimulator({ ...inventory, devicetypes: [{ name: 'iPhone 18', identifier: 'iphone18' }] })).toThrow('iPhone Duo');
});

test('requires an available iOS runtime with native Duo support', () => {
  expect(() => selectSimulator({ ...inventory, runtimes: [{ identifier: 'old', name: 'iOS 26.5', version: '26.5', isAvailable: true }] })).toThrow('27.1');
  expect(() => selectSimulator({ ...inventory, runtimes: [{ ...inventory.runtimes[0], isAvailable: false }] })).toThrow('runtime');
});

test('selects a requested iPad profile without matching a different size', () => {
  expect(selectSimulator(inventory, 'iPad Pro 13-inch (M5)').type.identifier).toBe('ipad');
  expect(() => selectSimulator(inventory, 'iPad Pro 11-inch (M5)')).toThrow('iPad Pro 11-inch');
});

test('chooses the newest available runtime numerically', () => {
  const selected = selectSimulator({ ...inventory, runtimes: [
    ...inventory.runtimes,
    { identifier: 'ios-27-10', name: 'iOS 27.10', version: '27.10', isAvailable: true },
    { identifier: 'ios-28-1', name: 'iOS 28.1', version: '28.1', isAvailable: false }
  ] });
  expect(selected.runtime.identifier).toBe('ios-27-10');
  expect(selected.device).toBeUndefined();
});

test('requires the SDK that exposes native Duo geometry instead of only a recent runtime', () => {
  expect(() => assertSdkSupport('27.2')).not.toThrow();
  expect(() => assertSdkSupport('27.1')).not.toThrow();
  expect(() => assertSdkSupport('27.0')).toThrow('SDK 27.1');
  expect(() => assertSdkSupport('26.5')).toThrow('SDK 27.1');
});

test('honors the newer iPad mini minimum runtime and supported device list', () => {
  const mini = { name: 'iPad mini (A20 Pro)', identifier: 'mini', minRuntimeVersionString: '27.2.0' };
  expect(() => selectSimulator({ ...inventory, devicetypes: [mini], runtimes: [
    { identifier: 'ios-27-1', name: 'iOS 27.1', version: '27.1', isAvailable: true }
  ] }, mini.name)).toThrow('27.2');
  expect(() => selectSimulator({ ...inventory, runtimes: [
    { ...inventory.runtimes[0], supportedDeviceTypes: [{ identifier: 'ipad' }] }
  ] })).toThrow('compatible');
});

test('reports a runtime migration warning and leaves actual app startup as the gate', () => {
  const warnings = [];
  reportBootStatus('Status=3, isTerminal=YES\nData Migration Failed', message => warnings.push(message));
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toContain('migration');
  expect(warnings[0]).toContain('app');
  reportBootStatus('Status=4294967295, isTerminal=YES\nFinished', message => warnings.push(message));
  reportBootStatus('Device already booted, nothing to do.', message => warnings.push(message));
  expect(warnings).toHaveLength(1);
});
