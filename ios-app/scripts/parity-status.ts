import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

const app = resolve(import.meta.dir, '..'), root = dirname(app);
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}
const nativeFiles = files(resolve(app, 'src')).filter(path => /\.(ts|tsx)$/.test(path));
const links = new Map<string, { target: string; mode: string }[]>();
let pendingTodos = 0;
for (const path of nativeFiles) {
  const content = readFileSync(path, 'utf8');
  for (const status of content.matchAll(/PORT STATUS: source ([^;]+); confidence [^;]+; todos (\d+)/g)) {
    pendingTodos += Number(status[2]);
    for (const source of (status[1] ?? '').split(/ and |, /)) {
      if (!existsSync(resolve(root, source))) continue;
      const items = links.get(source) ?? [];
      items.push({ target: relative(app, path), mode: 'native_draft' }); links.set(source, items);
    }
  }
  for (const imported of content.matchAll(/require\(['"](\.[^'"]+)['"]\)/g)) {
    const base = resolve(dirname(path), imported[1] ?? '');
    const source = ['', '.ts', '.tsx', '.json'].map(extension => `${base}${extension}`).find(candidate => existsSync(candidate) && !candidate.startsWith(`${app}/`));
    if (!source) continue;
    const key = relative(root, source), items = links.get(key) ?? [];
    items.push({ target: relative(app, path), mode: 'reuse_unchanged' }); links.set(key, items);
  }
}
const sources = files(resolve(root, 'resources/js/Pages')).filter(path => /\.(tsx|ts)$/.test(path));
for (const key of links.keys()) if (!sources.includes(resolve(root, key))) sources.push(resolve(root, key));
const rows = sources.sort().map(path => {
  const source = relative(root, path), targets = links.get(source) ?? [];
  const loc = readFileSync(path, 'utf8').split('\n').length;
  return [source, loc, targets.map(item => item.target).join('|') || 'PENDING', targets.map(item => item.mode).join('|') || 'unmapped', source.split('/')[3] ?? 'root'].join('\t');
});
if (process.argv.includes('--write')) writeFileSync(resolve(app, 'parity/file-map.tsv'), `source\tloc\ttarget\tdisposition\tsection\n${rows.join('\n')}\n`);
console.log(JSON.stringify({ sourceFiles: rows.length, mappedSourceFiles: links.size, nativeFiles: nativeFiles.length, declaredPortTodos: pendingTodos,
  verification: 'Draft mapping is not feature completion. Native visual, interaction, accessibility and behavior checks remain separate.' }, null, 2));
