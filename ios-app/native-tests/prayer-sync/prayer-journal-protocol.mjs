import https from 'node:https';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const refused = () => new Error('The local Prayer fixture requires journal protocol version 2 before native preparation.');
const endpoint = 'https://127.0.0.1:9443/__native_fixture/prayer-sync';

function probe(ca) {
  return new Promise((resolve, reject) => {
    let request, settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true; clearTimeout(timeout);
      if (error) reject(refused()); else resolve(value);
    };
    const timeout = setTimeout(() => { finish(true); request?.destroy(); }, 4000);
    try {
      request = https.request(endpoint, {
        method: 'POST', ca, rejectUnauthorized: true, agent: false,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'Content-Length': '2', 'Cache-Control': 'no-store' },
      }, response => {
        let size = 0;
        response.on('data', chunk => {
          size += chunk.length;
          if (size > 1024) { finish(true); response.destroy(); request.destroy(); }
        });
        response.on('error', () => finish(true));
        response.on('end', () => finish(false, { status: response.statusCode, version: response.headers['x-native-prayer-journal-version'] }));
      });
      request.on('error', () => finish(true));
      request.end('{}');
    } catch { finish(true); request?.destroy(); }
  });
}

export async function assertPrayerJournalProtocol(root, { readCA = readFileSync, transport = probe } = {}) {
  try {
    const ca = readCA(join(root, '.expo/local-fixture/tls/ca.pem'));
    const result = await transport(ca);
    if (result?.status !== 403 || result.version !== '2') throw refused();
  } catch { throw refused(); }
}
