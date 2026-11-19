import assert from 'node:assert/strict';
import test from 'node:test';
import { assertSelectedTestsPassed } from './native-test-results.mjs';

const selection = method => `SyrianZoneUITests/NativeFixtureTests${method ? `/${method}` : ''}`;
const leaf = (name, result = 'Passed') => ({ nodeType: 'Test Case', nodeIdentifier: `NativeFixtureTests/${name}()`, result });
const report = (...nodes) => ({ testNodes: [{ nodeType: 'Test Plan', children: [{ nodeType: 'Test Suite', children: nodes }] }] });

test('nested exact selected methods and every found class method must pass', () => {
  const passed = report(leaf('testOne'), leaf('testTwo'), { nodeType: 'Test Case', nodeIdentifier: 'OtherTests/testUnselected()', result: 'Skipped' });
  assert.doesNotThrow(() => assertSelectedTestsPassed([selection('testOne'), selection('testTwo')], passed));
  assert.doesNotThrow(() => assertSelectedTestsPassed([selection()], passed));
});

test('a skipped or failed selected case cannot be reported as a successful native run', () => {
  for (const result of ['Skipped', 'Failed', 'Expected Failure', 'Not Run', '', undefined]) {
    const node = leaf('testPhoto'); node.result = result;
    assert.throws(() => assertSelectedTestsPassed([selection('testPhoto')], report(node)), /did not pass/);
  }
});

test('a class selection rejects any non-passing discovered method', () => {
  assert.throws(() => assertSelectedTestsPassed([selection()], report(leaf('testOne'), leaf('testTwo', 'Skipped'))), /did not pass/);
});

test('every exact requested method must exist, including when another method in its class passed', () => {
  assert.throws(() => assertSelectedTestsPassed([selection('testOne'), selection('testTwo')], report(leaf('testOne'))), /did not execute/);
  assert.throws(() => assertSelectedTestsPassed([selection()], report()), /did not execute/);
  assert.throws(() => assertSelectedTestsPassed([selection('testOne')], report({ nodeType: 'Test Case', nodeIdentifier: 'NativeFixtureTestsExtra/testOne()', result: 'Passed' })), /did not execute/);
});

test('a later passing retry cannot hide a failed selected attempt', () => {
  assert.throws(() => assertSelectedTestsPassed([selection('testOne')], report(leaf('testOne', 'Failed'), leaf('testOne'))), /did not pass/);
});

test('malformed reports and empty selections cannot produce a green result', () => {
  for (const value of [null, {}, { testNodes: null }, { testNodes: [] }]) assert.throws(() => assertSelectedTestsPassed([selection('testOne')], value));
  assert.throws(() => assertSelectedTestsPassed([], report(leaf('testOne'))));
});
