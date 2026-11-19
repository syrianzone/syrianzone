import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
export function eagerSpecifiers(filename: string, source: string): string[] {
  const result: string[] = [];
  const tree = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
  function visit(node: ts.Node): void {
    if (ts.isFunctionLike(node)) return;
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && !node.importClause?.isTypeOnly) {
      const clause = node.importClause, named = clause?.namedBindings;
      if (!clause?.name && named && ts.isNamedImports(named) && named.elements.length > 0 && named.elements.every(element => element.isTypeOnly)) return;
      result.push(node.moduleSpecifier.text);
    }
    if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      if (node.exportClause && ts.isNamedExports(node.exportClause) && node.exportClause.elements.length > 0 && node.exportClause.elements.every(element => element.isTypeOnly)) return;
      result.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) result.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return [...new Set(result)];
}

function resolve(from: string, specifier: string): string | null {
  if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return null;
  const base = specifier.startsWith('@/') ? path.resolve(root, '../resources/js', specifier.slice(2)) : path.resolve(path.dirname(from), specifier);
  return [base, ...['.ts', '.tsx', '.js', '.json', '/index.ts', '/index.tsx', '/index.js'].map(extension => base + extension)].find(file => existsSync(file) && statSync(file).isFile()) ?? null;
}

function closure(entries: string[]): Set<string> {
  const files = new Set<string>();
  function visit(file: string): void {
    if (files.has(file)) return;
    files.add(file);
    if (file.endsWith('.json')) return;
    for (const specifier of eagerSpecifiers(file, readFileSync(file, 'utf8'))) {
      const dependency = resolve(file, specifier);
      if (dependency) visit(dependency);
    }
  }
  for (const entry of entries) visit(path.join(root, entry));
  return files;
}

export function startupImportReport() {
  const eager = closure(['src/App.tsx']);
  const transit = closure(['src/App.tsx', 'src/transit.tsx']), places = closure(['src/App.tsx', 'src/places.tsx']);
  const counterfactual = closure(['src/App.tsx', 'src/transit.tsx', 'src/places.tsx']);
  const metric = (files: Set<string>) => ({ modules: files.size, sourceBytes: [...files].reduce((sum, file) => sum + statSync(file).size, 0) });
  const deferred = new Set([...counterfactual].filter(file => !eager.has(file)));
  return {
    scope: 'Syntactic eager repository-local imports, reexports and top-level literal requires; excludes external packages, dynamic imports and function-local requires.',
    limitation: 'Source bytes are not bundle bytes, memory or latency. Counterfactual adds both map module roots to the current App; first-open costs still need native measurement.',
    eager: metric(eager), withMapRootsEager: metric(counterfactual), deferred: metric(deferred),
    firstTransit: metric(new Set([...transit].filter(file => !eager.has(file)))),
    firstPlacesOrSaved: metric(new Set([...places].filter(file => !eager.has(file)))),
    deferredFiles: [...deferred].map(file => path.relative(root, file)).sort()
  };
}

if (import.meta.main) console.log(JSON.stringify(startupImportReport(), null, 2));
