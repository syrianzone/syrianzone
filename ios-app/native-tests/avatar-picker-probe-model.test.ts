import { describe, expect, it } from 'bun:test';
import { avatarProbeCacheUri } from './avatar-picker-probe-model';
const cache = 'file:///private/mobile/Application/fixture/Library/Caches/';
const name = '12345678-1234-4234-8234-123456789abc.jpg';
describe('avatar probe exact returned cache copy boundary', () => {
  it('accepts the installed picker cache layouts with UUID file names', () => {
    for (const path of [name, `ImagePicker/${name}`, name.replace('.jpg', '.PNG')]) expect(avatarProbeCacheUri(cache + path, cache)).toBe(cache + path);
  });
  it('refuses other origins, directories, siblings, traversal and arbitrary files', () => {
    for (const uri of ['https://example.test/image.jpg', `file://foreign/Library/Caches/${name}`, cache,
      cache + 'ImagePicker/', cache + 'other.jpg', cache + `Other/${name}`, cache + `ImagePicker/nested/${name}`,
      cache + `../Documents/${name}`, cache + `ImagePicker/%2e%2e/${name}`, cache + `%49magePicker%2f${name}`,
      cache.replace('/Caches/', '/Caches-other/') + name, cache + name + '?x=1', cache + name + '#x', cache + name + '/extra']) {
      expect(() => avatarProbeCacheUri(uri, cache)).toThrow();
    }
  });
  it('requires a local cache root even for a plausible file URI', () => {
    for (const root of ['https://example.test/cache/', 'file://foreign/cache/', cache + '?x=1']) expect(() => avatarProbeCacheUri(cache + name, root)).toThrow();
  });
});
