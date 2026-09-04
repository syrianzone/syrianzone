import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const configuredSourceRoot = process.env.PORT_SOURCE_ROOT?.trim();
const sourceRoot = configuredSourceRoot ? resolve(configuredSourceRoot) : root;

const errors = [];
const warnings = [];

function fail(message) {
  errors.push(message);
}

function lines(path) {
  return readFileSync(path, 'utf8').split('\n').length - 1;
}

function repoPath(path) {
  return resolve(root, path);
}

function sourcePath(path) {
  const candidate = resolve(sourceRoot, path);
  if (existsSync(candidate) && statSync(candidate).isFile()) {
    return candidate;
  }
  return null;
}

function sourceDirectoryPath(path) {
  const candidate = resolve(sourceRoot, path);
  if (existsSync(candidate) && statSync(candidate).isDirectory()) {
    return candidate;
  }
  return null;
}

function readTsv(path, expectedHeader) {
  const content = readFileSync(repoPath(path), 'utf8').trimEnd();
  const rows = content.split('\n').map((line, index) => {
    const fields = line.split('\t');
    if (index === 0) {
      if (fields.join('\t') !== expectedHeader.join('\t')) {
        fail(`${path}: unexpected header`);
      }
    } else if (fields.length !== expectedHeader.length) {
      fail(`${path}:${index + 1}: expected ${expectedHeader.length} fields, found ${fields.length}`);
    }
    return fields;
  });
  return rows.slice(1);
}

function walk(path) {
  const files = [];
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const child = resolve(path, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(child));
    } else if (entry.isFile()) {
      files.push(child);
    }
  }
  return files;
}

const manifest = new Map();
for (const [index, line] of readFileSync(repoPath('port-manifest.tsv'), 'utf8')
  .trimEnd()
  .split('\n')
  .entries()) {
  const fields = line.split('\t');
  if (fields.length !== 2) {
    fail(`port-manifest.tsv:${index + 1}: expected 2 fields, found ${fields.length}`);
    continue;
  }
  const [source, rawLoc] = fields;
  const loc = Number(rawLoc);
  if (!source || !Number.isInteger(loc) || loc < 1) {
    fail(`port-manifest.tsv:${index + 1}: invalid source or line count`);
    continue;
  }
  if (manifest.has(source)) {
    fail(`port-manifest.tsv:${index + 1}: duplicate source ${source}`);
    continue;
  }
  manifest.set(source, loc);

  const actualSource = sourcePath(source);
  if (!actualSource) {
    warnings.push(`${source}: source snapshot isn't available for line verification`);
  } else if (lines(actualSource) !== loc) {
    fail(`${source}: manifest has ${loc} lines, source has ${lines(actualSource)}`);
  }
}

const excludedSourceFiles = new Set([
  'resources/js/Components/admin/AdminPollGroupManager.tsx',
  'resources/js/Components/DevRoleSwitcher.tsx',
  'resources/js/Lib/arcjet.ts',
  'resources/js/Lib/guessWhoSession.ts',
  'resources/js/Lib/utils.ts',
  'resources/js/Pages/Population/lib/csv-parser.ts',
  'resources/js/Pages/Population/syria_environmental_data_report.json',
]);
const excludedSourceDirectories = [
  'resources/js/Components/sycn/',
  'resources/js/Components/ui/',
];
const requiredSourceDirectories = [
  'resources/js/Pages',
  'resources/js/Components',
  'resources/js/Contexts',
  'resources/js/Lib',
  'resources/js/Data',
  'resources/js/Providers',
];

function isExcludedSource(source) {
  return excludedSourceFiles.has(source) ||
    excludedSourceDirectories.some((directory) => source.startsWith(directory));
}

for (const requiredSourceDirectory of requiredSourceDirectories) {
  const actualSourceDirectory = sourceDirectoryPath(requiredSourceDirectory);
  if (!actualSourceDirectory) {
    fail(`${requiredSourceDirectory}: authoritative source directory isn't available for manifest coverage`);
    continue;
  }
  for (const sourceFile of walk(actualSourceDirectory).filter((path) => /\.(?:[jt]sx?|json|md)$/.test(path))) {
    const suffix = sourceFile.slice(actualSourceDirectory.length + 1).replaceAll('\\', '/');
    const source = `${requiredSourceDirectory}/${suffix}`;
    if (!isExcludedSource(source) && !manifest.has(source)) {
      fail(`${source}: source file is missing from port-manifest.tsv`);
    }
  }
}

const trailerPattern = /\/\*\s*PORT STATUS\s+source:\s+(\S+) \((\d+) lines\)\s+confidence:\s+(high|medium|low)\s+todos:\s+(\d+)\s+notes:\s+([^\n]+)\s*\*\//g;
const targetsBySource = new Map();
const sourceCodeFiles = walk(repoPath('mobile/src')).filter((path) => /\.[jt]sx?$/.test(path));
const sourceCodeFileSet = new Set(sourceCodeFiles);
let trailerCount = 0;
for (const target of sourceCodeFiles.filter((path) => /\.tsx?$/.test(path))) {
  const content = readFileSync(target, 'utf8');
  const relativeTarget = target.slice(root.length + 1);
  const matches = [...content.matchAll(trailerPattern)];
  if (content.includes('PORT STATUS') && matches.length === 0) {
    fail(`${relativeTarget}: malformed PORT STATUS trailer`);
  }
  const trailer = matches.at(-1);
  if (trailer && content.slice(trailer.index + trailer[0].length).trim() !== '') {
    fail(`${relativeTarget}: PORT STATUS trailer isn't at the end of the file`);
  }
  if (/TODO\(port\)|PERF\(port\)|confidence:\s+(?:low|medium)/.test(content)) {
    fail(`${relativeTarget}: unresolved port marker`);
  }
  for (const match of matches) {
    trailerCount += 1;
    const [, source, rawLoc, confidence, rawTodos] = match;
    const loc = Number(rawLoc);
    const todos = Number(rawTodos);
    if (!manifest.has(source)) {
      fail(`${relativeTarget}: trailer source isn't in port-manifest.tsv: ${source}`);
      continue;
    }
    if (manifest.get(source) !== loc) {
      fail(`${relativeTarget}: trailer line count ${loc} doesn't match manifest ${manifest.get(source)} for ${source}`);
    }
    if (confidence !== 'high' || todos !== 0) {
      fail(`${relativeTarget}: trailer must be high confidence with zero todos`);
    }
    const targets = targetsBySource.get(source) ?? [];
    targets.push(relativeTarget);
    targetsBySource.set(source, targets);
  }
}
for (const source of manifest.keys()) {
  if (!targetsBySource.has(source)) {
    fail(`${source}: no target PORT STATUS trailer`);
  }
}

function resolveLocalImport(importer, specifier) {
  let base;
  if (specifier.startsWith('@/')) {
    base = resolve(repoPath('mobile/src'), specifier.slice(2));
  } else if (specifier.startsWith('.')) {
    base = resolve(dirname(importer), specifier);
  } else {
    return null;
  }

  for (const candidate of [
    base,
    ...['.ts', '.tsx', '.js', '.jsx'].map((extension) => `${base}${extension}`),
    ...['index.ts', 'index.tsx', 'index.js', 'index.jsx'].map((file) => resolve(base, file)),
  ]) {
    if (sourceCodeFileSet.has(candidate)) {
      return candidate;
    }
  }
  return null;
}

function localImports(path) {
  const content = readFileSync(path, 'utf8');
  const specifiers = [];
  for (const pattern of [
    /\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\b(?:require|import)\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]) {
    for (const match of content.matchAll(pattern)) {
      specifiers.push(match[1]);
    }
  }
  return specifiers
    .map((specifier) => resolveLocalImport(path, specifier))
    .filter((candidate) => candidate !== null);
}

const routeDirectory = repoPath('mobile/src/app');
const routeEntries = walk(routeDirectory).filter(
  (path) => /\.[jt]sx?$/.test(path) && !/\.test\.[jt]sx?$/.test(path),
);
const reachableTargets = new Set(routeEntries);
const importQueue = [...routeEntries];
while (importQueue.length > 0) {
  const importer = importQueue.pop();
  for (const dependency of localImports(importer)) {
    if (!reachableTargets.has(dependency)) {
      reachableTargets.add(dependency);
      importQueue.push(dependency);
    }
  }
}
for (const [source, targets] of targetsBySource.entries()) {
  for (const target of targets) {
    if (!reachableTargets.has(repoPath(target))) {
      fail(`${target}: port target for ${source} isn't reachable from an Expo Router entry`);
    }
  }
}

const apiRows = readTsv('mobile-api.tsv', [
  'module',
  'method',
  'path',
  'server_evidence',
  'mobile_evidence',
  'auth',
  'role',
  'port_status',
]);
const apiModules = new Set();
const apiKeys = new Set();
const firstPartyRouteKeys = new Set();
const routeResult = spawnSync('php', ['artisan', 'route:list', '--json'], {
  cwd: sourceRoot,
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
});
let routes = [];
if (routeResult.error || routeResult.status !== 0) {
  // No php on the host is the common case on this box; say so instead of crashing.
  const detail = routeResult.error?.message ?? routeResult.stderr?.trim() ?? '';
  fail(`php artisan route:list --json failed: ${detail}`);
} else {
  try {
    routes = JSON.parse(routeResult.stdout);
  } catch (error) {
    fail(`php artisan route:list returned invalid JSON: ${error.message}`);
  }
}
const routesByKey = new Map();
for (const route of routes) {
  for (const method of route.method.split('|')) {
    routesByKey.set(`${method}\t/${route.uri}`, route);
  }
}
const allowedStatuses = new Set([
  'declared-external',
  'direct-external',
  'implemented',
  'server-only',
  'server-only-external',
]);
for (const [index, row] of apiRows.entries()) {
  const [module, method, path, serverEvidence, mobileEvidence, , , status] = row;
  const line = index + 2;
  if (apiModules.has(module)) {
    fail(`mobile-api.tsv:${line}: duplicate module ${module}`);
  }
  apiModules.add(module);
  const apiKey = `${method}\t${path}`;
  if (apiKeys.has(apiKey)) {
    fail(`mobile-api.tsv:${line}: duplicate method and path ${method} ${path}`);
  }
  apiKeys.add(apiKey);
  if (!allowedStatuses.has(status)) {
    fail(`mobile-api.tsv:${line}: unknown port status ${status}`);
  }
  if (status === 'implemented' && mobileEvidence === '-') {
    fail(`mobile-api.tsv:${line}: implemented dependency needs mobile evidence`);
  }
  if (status === 'server-only' && mobileEvidence !== '-') {
    fail(`mobile-api.tsv:${line}: server-only dependency must not claim mobile evidence`);
  }
  if (status.endsWith('external') && path.startsWith('/api/')) {
    fail(`mobile-api.tsv:${line}: first-party API route cannot use an external status`);
  }
  if (serverEvidence !== '-') {
    for (const evidencePath of serverEvidence.split('|')) {
      if (!sourcePath(evidencePath)) {
        fail(`mobile-api.tsv:${line}: missing server evidence ${evidencePath}`);
      }
    }
  }
  if (mobileEvidence !== '-') {
    for (const evidencePath of mobileEvidence.split('|')) {
      if (!existsSync(repoPath(evidencePath))) {
        fail(`mobile-api.tsv:${line}: missing mobile evidence ${evidencePath}`);
      }
    }
  }
  if (!path.startsWith('/api/')) {
    continue;
  }
  const routePath = path.split('?', 1)[0];
  firstPartyRouteKeys.add(`${method}\t${routePath}`);
  const route = routesByKey.get(`${method}\t${routePath}`);
  if (!route) {
    fail(`mobile-api.tsv:${line}: Laravel route isn't registered: ${method} ${routePath}`);
    continue;
  }
  if (route.action.includes('@')) {
    const controller = `${route.action.split('@', 1)[0].replace(/^App\\/, 'app/').replaceAll('\\', '/')}.php`;
    if (!serverEvidence.split('|').includes(controller)) {
      fail(`mobile-api.tsv:${line}: server evidence doesn't match ${controller}`);
    }
  }
}
for (const route of routes.filter(
  ({ action, uri }) =>
    uri.startsWith('api/mobile/') ||
    action.startsWith('App\\Http\\Controllers\\Mobile\\'),
)) {
  for (const method of route.method.split('|').filter((value) => value !== 'HEAD')) {
    const key = `${method}\t/${route.uri}`;
    if (!firstPartyRouteKeys.has(key)) {
      fail(`mobile-api.tsv: missing registered mobile route ${method} /${route.uri}`);
    }
  }
}

const assetRows = readTsv('mobile-assets.tsv', [
  'family',
  'source_paths',
  'mobile_strategy',
  'source_evidence',
  'target_evidence',
]);
const assetFamilies = new Set();
for (const [index, row] of assetRows.entries()) {
  const [family, , , sourceEvidence, targetEvidence] = row;
  const line = index + 2;
  if (assetFamilies.has(family)) {
    fail(`mobile-assets.tsv:${line}: duplicate family ${family}`);
  }
  assetFamilies.add(family);
  for (const evidence of sourceEvidence.split('|')) {
    if (!sourcePath(evidence)) {
      fail(`mobile-assets.tsv:${line}: source evidence isn't available: ${evidence}`);
    }
  }
  if (targetEvidence === '-') {
    continue;
  }
  for (const evidence of targetEvidence.split('|')) {
    if (!existsSync(repoPath(evidence))) {
      fail(`mobile-assets.tsv:${line}: missing target evidence ${evidence}`);
    }
  }
}

for (const style of ['dark-matter.json', 'light.json']) {
  const source = sourcePath(`public/styles/styles/${style}`);
  const target = repoPath(`mobile/assets/styles/${style}`);
  if (!source || !existsSync(target)) {
    continue;
  }
  if (readFileSync(source, 'utf8') !== readFileSync(target, 'utf8')) {
    fail(`mobile/assets/styles/${style}: bundled style differs from its source`);
  }
}

const placesMap = readFileSync(repoPath('mobile/src/features/Places/_components/PlacesMap.tsx'), 'utf8');
for (const style of ['dark-matter-vector.json', 'light-vector.json']) {
  const source = sourcePath(`public/styles/styles/${style}`);
  const target = repoPath(`mobile/assets/styles/${style}`);
  if (!source) {
    fail(`public/styles/styles/${style}: vector place style is missing`);
    continue;
  }
  if (!existsSync(target)) {
    fail(`mobile/assets/styles/${style}: bundled vector style is missing`);
    continue;
  }
  if (readFileSync(source, 'utf8') !== readFileSync(target, 'utf8')) {
    fail(`mobile/assets/styles/${style}: bundled vector style differs from its source`);
  }

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(source, 'utf8'));
  } catch (error) {
    fail(`public/styles/styles/${style}: invalid JSON: ${error.message}`);
    continue;
  }

  const countryLayers = new Map(
    (parsed.layers ?? [])
      .filter(({ id }) => id === 'place_country_1' || id === 'place_country_2')
      .map((layer) => [layer.id, layer]),
  );
  for (const id of ['place_country_1', 'place_country_2']) {
    const textField = countryLayers.get(id)?.layout?.['text-field'];
    const serialized = JSON.stringify(textField);
    if (!serialized.includes('Israel') || !serialized.includes('Palestine')) {
      fail(`public/styles/styles/${style}: ${id} is missing the Palestine label override`);
    }
  }

  if (!placesMap.includes(`@/assets/styles/${style}`)) {
    fail(`mobile/src/features/Places/_components/PlacesMap.tsx: place map does not reference ${style}`);
  }
}

for (const path of [
  'PORTING.md',
  'mobile-api.tsv',
  'mobile-assets.tsv',
  'port-manifest.tsv',
  'mobile/scripts/verify-port-contract.mjs',
]) {
  if (/[\u2013\u2014]/.test(readFileSync(repoPath(path), 'utf8'))) {
    fail(`${path}: contains a long dash`);
  }
}

if (warnings.length > 0) {
  for (const warning of warnings) {
    console.warn(`warning: ${warning}`);
  }
}
if (errors.length > 0) {
  for (const error of errors) {
    console.error(`error: ${error}`);
  }
  process.exit(1);
}

console.log(
  `port contract ok: ${manifest.size} sources, ${trailerCount} targets, ${apiRows.length} API dependencies, ${assetRows.length} asset families`,
);
