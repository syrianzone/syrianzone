import { expect, test } from 'bun:test';
import { basename } from 'node:path';
import { namedExportLocation } from './export-location';

test('shared file basename preserves the requested Unicode name and extension while concurrent exports stay isolated', () => {
  const id = '9c2015ae-c5b4-4d9d-bb19-5bd26b792e49';
  for (const filename of ['خريطة دمشق.png', 'political-compass.jpg', 'nested-assets.zip', 'answer-card.svg']) {
    const first = namedExportLocation(filename, id), second = namedExportLocation(filename, '49ba91ab-6120-4893-bde4-091c20b69ea4');
    expect(basename(`${first.directory}/${first.filename}`)).toBe(filename);
    expect(first.directory).not.toBe(second.directory);
    expect(first.directory.startsWith('sz-')).toBe(true);
  }
  for (const filename of ['../secret.png', '/secret.png', 'bad\\name.png', 'bad\u0000.png']) expect(() => namedExportLocation(filename, id)).toThrow();
});
