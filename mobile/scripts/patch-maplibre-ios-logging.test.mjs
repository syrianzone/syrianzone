import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { patchMapLibreIosLogging } from './patch-maplibre-ios-logging.mjs';

const original = `- (id)init {
  if (self = [super init]) {
    self.loggingConfiguration = [MLNLoggingConfiguration sharedConfiguration];
    [self.loggingConfiguration setLoggingLevel:MLNLoggingLevelWarning];
    __weak typeof(self) weakSelf = self;
  }
  return self;
}
`;

const patched = original.replace(
  'setLoggingLevel:MLNLoggingLevelWarning',
  'setLoggingLevel:MLNLoggingLevelNone',
);

test('patches the original MapLibre iOS logging initializer', () => {
  const result = patchMapLibreIosLogging(original);

  assert.equal(result.changed, true);
  assert.equal(result.source, patched);
});

test('keeps an already patched MapLibre iOS initializer unchanged', () => {
  const result = patchMapLibreIosLogging(patched);

  assert.equal(result.changed, false);
  assert.equal(result.source, patched);
});

test('rejects upstream MapLibre iOS logging drift', () => {
  const drifted = original.replace(
    'setLoggingLevel:MLNLoggingLevelWarning',
    'setLoggingLevel:MLNLoggingLevelInfo',
  );

  assert.throws(
    () => patchMapLibreIosLogging(drifted),
    /MapLibre iOS logging source drifted/,
  );
});

test('rejects duplicate and mixed MapLibre iOS logging contexts', () => {
  for (const source of [`${original}\n${original}`, `${original}\n${patched}`]) {
    assert.throws(
      () => patchMapLibreIosLogging(source),
      /MapLibre iOS logging source drifted/,
    );
  }
});

test('recognizes the installed MapLibre iOS logging source as patched', () => {
  const target = resolve(
    import.meta.dirname,
    '../node_modules/@maplibre/maplibre-react-native/ios/modules/logging/MLRNLogging.m',
  );
  const source = readFileSync(target, 'utf8');
  const result = patchMapLibreIosLogging(source);

  assert.equal(
    result.changed,
    false,
    'Installed MapLibre source is unpatched. Run npm postinstall before building.',
  );
});
