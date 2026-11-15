import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { importLayerViolations, importSpecifiers } from './import-layers';

test('layer gate resolves imports, reexports, require and dynamic imports rather than matching comments', () => {
  const root = '/project/src', file = '/project/src/features/Games/Trix/Index.tsx';
  expect(importSpecifiers("// import '../Wrong'\nexport { value } from '../model'; import('../Other'); require('../../Places/model');")).toEqual(['../model', '../Other', '../../Places/model']);
  expect(importLayerViolations(root, file, "import { x } from '../model'; import type { Y } from '../../Places/model';")).toEqual(['features/Games/Trix/Index.tsx -> ../../Places/model']);
  expect(importLayerViolations(root, '/project/src/platform/cache.ts', "export * from '../features/Games/model';")).toEqual(['platform/cache.ts -> ../features/Games/model']);
  expect(importLayerViolations(root, '/project/src/domain.ts', "export * from './features/Places/model';")).toHaveLength(1);
  expect(importLayerViolations(root, file, "import('../../../platform/geo');")).toEqual([]);
  expect(importLayerViolations(root, file, "import('@/features/Places/model');")).toHaveLength(1);
});

test('native feature modules never import another feature and shared modules never import features', () => {
  const root = resolve(import.meta.dir, '../src'), violations: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) violations.push(...importLayerViolations(root, path, readFileSync(path, 'utf8')));
    }
  };
  walk(root); expect(violations).toEqual([]);
});
