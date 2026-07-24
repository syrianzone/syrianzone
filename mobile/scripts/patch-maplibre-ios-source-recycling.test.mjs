import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  mapLibreIosSourceComponents,
  patchMapLibreIosSourceRecycling,
} from './patch-maplibre-ios-source-recycling.mjs';

function originalSource(component) {
  return `- (instancetype)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const ${component.propsClass}>();
    _props = defaultProps;
    [self prepareView];
  }

  return self;
}

- (void)prepareView {
  _view = [[${component.viewClass} alloc] init];
}
`;
}

function patchedSource(component) {
  return `- (instancetype)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    [self prepareView];
  }

  return self;
}

- (void)prepareForRecycle {
  [super prepareForRecycle];
  [self prepareView];
}

- (void)prepareView {
  static const auto defaultProps = std::make_shared<const ${component.propsClass}>();
  _props = defaultProps;

  _view = [[${component.viewClass} alloc] init];
}
`;
}

test('resets every MapLibre iOS source when Fabric recycles its view', () => {
  for (const component of mapLibreIosSourceComponents) {
    const result = patchMapLibreIosSourceRecycling(
      originalSource(component),
      component,
    );

    assert.equal(result.changed, true, component.label);
    assert.equal(result.source, patchedSource(component), component.label);
  }
});

test('keeps every patched source component unchanged', () => {
  for (const component of mapLibreIosSourceComponents) {
    const source = patchedSource(component);
    const result = patchMapLibreIosSourceRecycling(source, component);

    assert.equal(result.changed, false, component.label);
    assert.equal(result.source, source, component.label);
  }
});

test('rejects upstream GeoJSON source component drift', () => {
  const component = mapLibreIosSourceComponents[0];
  const original = originalSource(component);
  const drifted = original.replace(
    '[self prepareView];',
    '[self prepareGeoJSONView];',
  );

  assert.throws(
    () => patchMapLibreIosSourceRecycling(drifted, component),
    /MapLibre iOS GeoJSON source recycling code drifted/,
  );
});

test('rejects duplicate and mixed GeoJSON recycling contexts', () => {
  const component = mapLibreIosSourceComponents[0];
  const original = originalSource(component);
  const patched = patchedSource(component);
  for (const source of [`${original}\n${original}`, `${original}\n${patched}`]) {
    assert.throws(
      () => patchMapLibreIosSourceRecycling(source, component),
      /MapLibre iOS GeoJSON source recycling code drifted/,
    );
  }
});

test('recognizes every installed source component as patched', () => {
  for (const component of mapLibreIosSourceComponents) {
    const target = resolve(import.meta.dirname, component.relativePath);
    const source = readFileSync(target, 'utf8');
    const result = patchMapLibreIosSourceRecycling(source, component);

    assert.equal(
      result.changed,
      false,
      `${component.label} recycling is unpatched. Run npm postinstall before building.`,
    );
  }
});
