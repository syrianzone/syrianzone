import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const xml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');

// Minimal loopback S3 protocol fixture for the real PHP AWS/Flysystem clients.
// It covers small object upload/list/read/delete. No cloud credentials are used.
export function storageServer(runtime) {
  const root = path.join(runtime, 'storage/app/fixture-assets');
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const files = (folder = root) => readdirSync(folder, { withFileTypes: true }).flatMap((item) => {
    const file = path.join(folder, item.name);
    return item.isDirectory() ? files(file) : item.isFile() ? [{ file, key: path.relative(root, file).split(path.sep).join('/') }] : [];
  });
  return http.createServer((incoming, outgoing) => {
    outgoing.setHeader('x-amz-request-id', 'native-local-fixture');
    const fail = (status, code) => { outgoing.writeHead(status, { 'Content-Type': 'application/xml' }); outgoing.end(`<Error><Code>${code}</Code></Error>`); };
    if (incoming.socket.remoteAddress !== '127.0.0.1') { fail(403, 'AccessDenied'); return; }
    const url = new URL(incoming.url ?? '/', 'http://127.0.0.1:9019');
    let decoded;
    try { decoded = decodeURIComponent(url.pathname); } catch { fail(400, 'InvalidURI'); return; }
    if (!decoded.startsWith('/native-fixture')) { fail(404, 'NoSuchBucket'); return; }
    const key = decoded.slice('/native-fixture'.length).replace(/^\//, '');
    if (key.includes('\\') || key.includes('\0') || key.split('/').some((part) => part === '.' || part === '..')) { fail(400, 'InvalidArgument'); return; }
    const file = path.resolve(root, key);
    if (file !== root && !file.startsWith(root + path.sep)) { fail(403, 'AccessDenied'); return; }
    if (url.searchParams.has('uploads') || url.searchParams.has('uploadId')) { fail(501, 'NotImplemented'); return; }
    if (incoming.method === 'GET' && !key) {
      const max = Math.min(Math.max(Number(url.searchParams.get('max-keys') ?? 1000), 1), 1000);
      const token = url.searchParams.get('continuation-token');
      const offset = token ? Number(Buffer.from(token, 'base64').toString('utf8')) : 0;
      if (!Number.isSafeInteger(offset) || offset < 0) { fail(400, 'InvalidToken'); return; }
      const all = files().sort((a, b) => a.key.localeCompare(b.key));
      const page = all.slice(offset, offset + max);
      const more = offset + max < all.length;
      const contents = page.map(({ file, key }) => { const stat = statSync(file); return `<Contents><Key>${xml(key)}</Key><LastModified>${stat.mtime.toISOString()}</LastModified><ETag>&quot;${createHash('md5').update(readFileSync(file)).digest('hex')}&quot;</ETag><Size>${stat.size}</Size><StorageClass>STANDARD</StorageClass></Contents>`; }).join('');
      outgoing.writeHead(200, { 'Content-Type': 'application/xml' });
      outgoing.end(`<?xml version="1.0" encoding="UTF-8"?><ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>native-fixture</Name><Prefix></Prefix><KeyCount>${page.length}</KeyCount><MaxKeys>${max}</MaxKeys><IsTruncated>${more}</IsTruncated>${more ? `<NextContinuationToken>${Buffer.from(String(offset + max)).toString('base64')}</NextContinuationToken>` : ''}${contents}</ListBucketResult>`);
    } else if (incoming.method === 'PUT' && key) {
      const chunks = [];
      let bytes = 0;
      incoming.on('data', (chunk) => { bytes += chunk.length; if (bytes > 52428800) incoming.destroy(); else chunks.push(chunk); });
      incoming.on('end', () => {
        mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
        const content = Buffer.concat(chunks);
        writeFileSync(file, content, { mode: 0o600 });
        outgoing.writeHead(200, { ETag: `"${createHash('md5').update(content).digest('hex')}"` });
        outgoing.end();
      });
    } else if (incoming.method === 'DELETE' && key) {
      if (existsSync(file) && statSync(file).isFile()) unlinkSync(file);
      outgoing.writeHead(204); outgoing.end();
    } else if (['HEAD', 'GET'].includes(incoming.method) && key) {
      if (!existsSync(file) || !statSync(file).isFile()) { fail(404, 'NoSuchKey'); return; }
      const content = readFileSync(file);
      const contentType = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml', pdf: 'application/pdf' }[path.extname(file).slice(1)] ?? 'application/octet-stream';
      outgoing.writeHead(200, { 'Content-Length': content.length, 'Content-Type': contentType, 'Last-Modified': statSync(file).mtime.toUTCString(), ETag: `"${createHash('md5').update(content).digest('hex')}"` });
      outgoing.end(incoming.method === 'HEAD' ? undefined : content);
    } else fail(405, 'MethodNotAllowed');
  });
}
