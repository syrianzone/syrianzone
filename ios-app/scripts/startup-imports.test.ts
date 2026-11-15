import { expect, test } from 'bun:test';
import { eagerSpecifiers, startupImportReport } from './startup-imports';

test('startup graph follows runtime declarations and excludes erased or deferred imports', () => {
  expect(eagerSpecifiers('fixture.ts', [
    "import type { A } from './type';",
    "import { type B } from './inline-type';",
    "import { type C, value } from './mixed';",
    "import './effect';",
    "import {} from './empty-import-effect';",
    "export type { D } from './export-type';",
    "export { type E } from './inline-export-type';",
    "export { value as alias } from './export-value';",
    "export {} from './empty-export-effect';",
    "const immediate = require('./now');",
    "const later = () => require('./later');",
    "function hidden() { return require('./hidden'); }",
    "const asyncRoute = () => import('./async');"
  ].join('\n'))).toEqual(['./mixed', './effect', './empty-import-effect', './export-value', './empty-export-effect', './now']);
});

test('Home eager graph excludes map entry modules and reports their first-open work separately', () => {
  const report = startupImportReport();
  expect(report.deferredFiles).toContain('src/transit.tsx');
  expect(report.deferredFiles).toContain('src/places.tsx');
  expect(report.deferredFiles).toContain('src/MapView.tsx');
  expect(report.deferredFiles).toContain('src/features/Places/PhotoPicker.tsx');
  expect(report.deferred.modules).toBe(report.withMapRootsEager.modules - report.eager.modules);
  expect(report.deferred.sourceBytes).toBeGreaterThan(0);
  expect(report.firstTransit.modules).toBeGreaterThan(0);
  expect(report.firstPlacesOrSaved.modules).toBeGreaterThan(0);
});
