import { expect, test } from 'bun:test';
import { parseRealtimeConfig } from './realtime-config';

test('reads the four public Reverb primitives without executing page scripts', () => {
  expect(parseRealtimeConfig('<script>window.REVERB_CONFIG = window.REVERB_CONFIG || { host: "ws.syrian.zone", port: 443, scheme: "https", key: "public-key", };</script>'))
    .toEqual({ host: 'ws.syrian.zone', port: 443, scheme: 'https', key: 'public-key' });
});
test('rejects executable expressions, duplicate keys and unencrypted sockets', () => {
  for (const body of ['host: getHost(), port:443,scheme:"https",key:"x"', 'host:"a",host:"b",port:443,scheme:"https",key:"x"', 'host:"a",port:80,scheme:"http",key:"x"']) expect(() => parseRealtimeConfig(`window.REVERB_CONFIG = window.REVERB_CONFIG || {${body}};`)).toThrow();
});
