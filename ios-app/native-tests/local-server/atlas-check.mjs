import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const runtime = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.expo/local-fixture');
const fixture = JSON.parse(readFileSync(path.join(runtime, 'fixture.json'), 'utf8'));
assert.equal(fixture.origin, 'https://127.0.0.1:9443');
assert.equal(fixture.databasePath, path.join(runtime, 'database.sqlite'));
assert.equal(readFileSync(path.join(runtime, 'fixture-marker'), 'utf8').trim(), 'native-loopback-fixture-v1');
const ca = readFileSync(path.join(runtime, 'tls/ca.pem'));
async function get(resource, headers = {}) {
  const url = new URL(resource, fixture.origin);
  assert.equal(url.origin, 'https://127.0.0.1:9443');
  return new Promise((resolve, reject) => {
    const request = https.get(url, { ca, headers: { Accept: 'application/json', ...headers } }, (response) => {
      const parts = []; let size = 0;
      response.on('data', (part) => {
        size += part.length;
        if (size > 2_000_000) { request.destroy(new Error('Unexpected Atlas response size.')); return; }
        parts.push(part);
      });
      response.on('end', () => {
        try {
          assert.equal(response.statusCode, 200);
          resolve(JSON.parse(Buffer.concat(parts).toString('utf8')));
        } catch (error) { reject(error); }
      });
    });
    request.on('error', reject);
    request.setTimeout(5000, () => request.destroy(new Error('Local Atlas request timed out.')));
  });
}
const atlas = await get('/api/v1/atlas');
const original = await get('/api/population/master');
assert.deepEqual(original, atlas, 'Original and v1 public protocols must expose the same source report.');
assert.ok(Array.isArray(atlas.groups.population), 'The synthetic population source must be present in the actual public report.');
const sources = atlas.groups.population.filter((row) => row.source_id === 910001);
assert.equal(sources.length, 1);
assert.deepEqual(sources[0], { source_id: 910001, note: 'بيانات اصطناعية للاختبار المحلي: ليست إحصاءات حقيقية', date: '2025-01-01', source_url: null, cities: { Damascus: 120000, Aleppo: 340000 } });
assert.equal(sources[0].cities.Damascus + sources[0].cities.Aleppo, 460000);
assert.deepEqual(atlas.rainfall_data.SY01, [{ year: 2024, rainfall: 110, rainfall_avg: 100 }, { year: 2025, rainfall: 130, rainfall_avg: 100 }]);
assert.deepEqual(atlas.rainfall_data.SY02, [{ year: 2024, rainfall: 220, rainfall_avg: 200 }, { year: 2025, rainfall: 260, rainfall_avg: 200 }]);
const page = await get('/atlas', { 'X-Inertia': 'true', 'X-Requested-With': 'XMLHttpRequest' });
assert.equal(page.component, 'Population/Index');
assert.equal(page.url, '/atlas');
assert.equal(Object.hasOwn(page.props, 'rainfall_data'), false, 'The original lazy shell must remain a shell.');
console.log('Public Atlas v1/original API and original Inertia shell passed: synthetic populations 120000/340000; 2025 rainfall 130/260 mm, averages 100/200 mm.');
