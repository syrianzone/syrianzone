import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

interface Inventory {
  pageRoutes: { uri: string; nativeTarget: { section: string; params: Record<string, string> } }[];
  redirectAliases: { uri: string; destination: string; preserveSourceQuery: boolean }[];
  filamentRoutes: { uri: string; nativeTarget?: { section: string; params: Record<string, string> } }[];
}
const inventory = JSON.parse(readFileSync(fileURLToPath(new URL('../parity/routes-and-shell.json', import.meta.url)), 'utf8')) as Inventory;
const pages = inventory.pageRoutes.map(route => ({ path: route.uri, section: route.nativeTarget.section, params: route.nativeTarget.params }));
const aliases = inventory.redirectAliases.map(route => ({ path: route.uri, destination: route.destination.replace(' (preserve query)', ''), preserveQuery: route.preserveSourceQuery }));
const filament = inventory.filamentRoutes.flatMap(route => route.nativeTarget ? [{ path: route.uri, section: route.nativeTarget.section, params: route.nativeTarget.params }] : []);
if (new Set(pages.map(route => route.path)).size !== pages.length || pages.some(route => !route.path.startsWith('/') || !route.section)) throw new Error('The audited route inventory is invalid.');
writeFileSync(fileURLToPath(new URL('../src/platform/website-routes.generated.ts', import.meta.url)), `// Generated from parity/routes-and-shell.json. Regenerate with scripts/generate-website-routes.ts.\nexport const websiteRoutes = ${JSON.stringify(pages, null, 2)} as const;\n\nexport const websiteRedirects = ${JSON.stringify(aliases, null, 2)} as const;\n\nexport const filamentNativeRoutes = ${JSON.stringify(filament, null, 2)} as const;\n`);
console.log(`Generated ${pages.length} page routes, ${aliases.length} redirect aliases, and ${filament.length} native Filament routes.`);
