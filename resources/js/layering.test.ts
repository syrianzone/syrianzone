/**
 * The dependency rule, machine-checked:
 *
 *   Pages/<Feature>  →  Domain/<module>  →  Components/ + Lib/ + Layouts/ + Contexts/ + Providers/
 *
 * Stable code must not import volatile code. Concretely:
 *
 *  (a) nothing in the shared layer (Components/, Lib/, Layouts/, Contexts/,
 *      Providers/) or in Domain/ may import `Pages/**`;
 *  (b) `Lib/` may use `Components/ui` primitives but not a higher-level
 *      component (rule ratcheted at today's one offender);
 *  (c) no imports between two different `Pages/<Feature>` folders (ratcheted at
 *      today's edges so the set can only shrink).
 *
 * The specifiers are resolved with the same alias vite.config.js and
 * tsconfig.json declare, so the test reads the graph the bundler builds.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';

const JS_DIR = path.dirname(fileURLToPath(import.meta.url));

const SOURCE_EXTENSIONS = ['.ts', '.tsx'];
const RESOLVE_EXTENSIONS = ['', '.ts', '.tsx', '.d.ts', '.js', '.jsx', '.json'];
const INDEX_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

/** The alias vite.config.js and tsconfig.json declare. */
const ALIASES: Array<[string, string]> = [['@/', JS_DIR]];

const SPECIFIER_PATTERNS = [
  /(?:^|[\s;])(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\bfrom\s*)?['"]([^'"]+)['"]/g,
  /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
];

const SHARED_LAYERS = ['Components', 'Lib', 'Layouts', 'Contexts', 'Providers'];

function toRelative(file: string): string {
  return path.relative(JS_DIR, file).split(path.sep).join('/');
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext)) ? [full] : [];
  });
}

function resolveFile(base: string): string | null {
  for (const extension of RESOLVE_EXTENSIONS) {
    const candidate = `${base}${extension}`;
    if (isFile(candidate)) return candidate;
  }
  for (const extension of INDEX_EXTENSIONS) {
    const candidate = path.join(base, `index${extension}`);
    if (isFile(candidate)) return candidate;
  }
  return null;
}

function isFile(candidate: string): boolean {
  try {
    return readdirSync(path.dirname(candidate)).includes(path.basename(candidate));
  } catch {
    return false;
  }
}

function resolveSpecifier(specifier: string, importer: string): string | null {
  if (specifier.startsWith('.')) {
    return resolveFile(path.resolve(path.dirname(importer), specifier));
  }
  for (const [prefix, target] of ALIASES) {
    if (specifier === prefix || specifier.startsWith(prefix)) {
      return resolveFile(path.join(target, specifier.slice(prefix.length)));
    }
  }
  return null;
}

interface Edge {
  from: string;
  to: string;
}

function collectEdges(): Edge[] {
  const edges: Edge[] = [];
  for (const file of walk(JS_DIR)) {
    const source = readFileSync(file, 'utf8');
    const seen = new Set<string>();
    for (const pattern of SPECIFIER_PATTERNS) {
      for (const match of source.matchAll(pattern)) {
        const specifier = match[1];
        if (seen.has(specifier)) continue;
        seen.add(specifier);
        const target = resolveSpecifier(specifier, file);
        if (target === null || !target.startsWith(JS_DIR)) continue;
        edges.push({ from: toRelative(file), to: toRelative(target) });
      }
    }
  }
  return edges;
}

function isUnder(relative: string, dir: string): boolean {
  return relative.startsWith(`${dir}/`);
}

/** `Pages/Board/x/y.ts` and `Pages/Home.tsx` both belong to a feature folder. */
function pageFeature(relative: string): string | null {
  if (!isUnder(relative, 'Pages')) return null;
  const segments = relative.split('/');
  if (segments.length === 2) return segments[1].replace(/\.tsx?$/, '');
  return segments[1];
}

const EDGES = collectEdges();

function label(edge: Edge): string {
  return `${edge.from} -> ${edge.to}`;
}

/**
 * Fails with a readable list when the graph differs from `allowed` in either
 * direction: `extra` is a new violation, `stale` is an allowlist line that must
 * be deleted because the edge is gone.
 */
function assertMatches(rule: string, actual: string[], allowed: string[]): void {
  const extra = actual.filter((edge) => !allowed.includes(edge)).sort();
  const stale = allowed.filter((edge) => !actual.includes(edge)).sort();
  if (extra.length === 0 && stale.length === 0) return;

  const lines = [`${rule}: the import graph changed.`];
  if (extra.length > 0) {
    lines.push('', 'New edges that break the rule (depend on stable code instead):');
    lines.push(...extra.map((edge) => `  ${edge}`));
  }
  if (stale.length > 0) {
    lines.push('', 'Allowlist entries that no longer exist (delete these lines):');
    lines.push(...stale.map((edge) => `  ${edge}`));
  }
  throw new Error(lines.join('\n'));
}

/** Shared code and Domain modules may not reach into a page folder. */
const SHARED_TO_PAGES_ALLOWED: string[] = [];

/** `Lib/` stays free of higher-level components; it may use `Components/ui`. */
const LIB_TO_COMPONENTS_ALLOWED: string[] = [];

/**
 * The `Pages/<A>` → `Pages/<B>` edges that remain, one per line. Nothing new
 * may be added; deleting one means deleting its line. Both survivors have a
 * reason outside the frontend, written next to them.
 */
const CROSS_FEATURE_ALLOWED = [
  // The 404 page shows the transit landing's city grid. `CityGrid` pulls in
  // `CityCard`, the map-data preload hook and the governorate icons (which PHP
  // reads by path in `GovernorateIconService`), so it stays with the feature.
  'Pages/Errors/NotFound.tsx -> Pages/Transit/_components/landing/CityGrid.tsx',
  // The tier-list leaderboard is the same table at both URLs (/tierlist and
  // /polls/<slug>): both page names are server contracts, so the alias stays.
  'Pages/TierList/Leaderboard.tsx -> Pages/Polls/Leaderboard.tsx',
];

describe('layering', () => {
  it('the shared layer and Domain modules do not import Pages/**', () => {
    const offending = EDGES.filter(
      (edge) =>
        (SHARED_LAYERS.some((layer) => isUnder(edge.from, layer)) || isUnder(edge.from, 'Domain')) &&
        isUnder(edge.to, 'Pages'),
    ).map(label);
    assertMatches('Shared → Pages', Array.from(new Set(offending)).sort(), SHARED_TO_PAGES_ALLOWED);
  });

  it('Lib/ only uses Components/ui, never a higher-level component', () => {
    const offending = EDGES.filter(
      (edge) =>
        isUnder(edge.from, 'Lib') &&
        isUnder(edge.to, 'Components') &&
        !isUnder(edge.to, 'Components/ui'),
    ).map(label);
    assertMatches('Lib → Components', Array.from(new Set(offending)).sort(), LIB_TO_COMPONENTS_ALLOWED);
  });

  it('no feature folder imports another feature folder', () => {
    const offending = EDGES.filter((edge) => {
      const from = pageFeature(edge.from);
      const to = pageFeature(edge.to);
      return from !== null && to !== null && from !== to;
    }).map(label);
    assertMatches('Pages → Pages', Array.from(new Set(offending)).sort(), CROSS_FEATURE_ALLOWED);
  });
});
