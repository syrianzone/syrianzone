import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const ASSETS_DIR = 'public/build/assets';
const EXTENSIONS = new Set(['.js', '.css', '.svg']);
const MIN_BYTES = 1024;

let count = 0;
let rawTotal = 0;
let gzTotal = 0;
let brTotal = 0;

for (const entry of readdirSync(ASSETS_DIR)) {
    if (!EXTENSIONS.has(extname(entry))) continue;
    const fullPath = join(ASSETS_DIR, entry);
    const stat = statSync(fullPath);
    if (!stat.isFile() || stat.size < MIN_BYTES) continue;

    const raw = readFileSync(fullPath);
    const br = brotliCompressSync(raw, {
        params: {
            [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
            [constants.BROTLI_PARAM_QUALITY]: 11,
            [constants.BROTLI_PARAM_SIZE_HINT]: raw.length,
        },
    });
    const gz = gzipSync(raw, { level: 9 });

    if (br.length < raw.length) writeFileSync(`${fullPath}.br`, br);
    if (gz.length < raw.length) writeFileSync(`${fullPath}.gz`, gz);

    count += 1;
    rawTotal += raw.length;
    gzTotal += gz.length;
    brTotal += br.length;
}

const kb = (b) => `${(b / 1024).toFixed(1)} KB`;
console.log(
    `Precompressed ${count} assets: raw ${kb(rawTotal)} -> gzip ${kb(gzTotal)} -> brotli-11 ${kb(brTotal)} (-${(((gzTotal - brTotal) / gzTotal) * 100).toFixed(1)}% vs gzip)`,
);
