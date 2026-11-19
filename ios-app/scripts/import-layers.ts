import ts from 'typescript';
import { relative, resolve } from 'node:path';

export function importSpecifiers(source: string, filename = 'module.ts'): string[] {
  const result: string[] = [], file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) result.push(node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === 'require')) {
      const argument = node.arguments[0];
      if (argument && ts.isStringLiteral(argument)) result.push(argument.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file); return result;
}

export function importLayerViolations(root: string, filename: string, source: string): string[] {
  const from = relative(root, filename).replaceAll('\\', '/'), sourceFeature = /^features\/([^/]+)\//.exec(from)?.[1];
  const isShared = /^(?:platform|ui|domain)\//.test(from)
    || /^(?:api|components|domain|resource|state|MapView|map-data|location|layout|NativeLayout|navigation)\.tsx?$/.test(from);
  if (!sourceFeature && !isShared) return [];
  return importSpecifiers(source, filename).flatMap(specifier => {
    const resolved = specifier.startsWith('.') ? relative(root, resolve(filename, '..', specifier)).replaceAll('\\', '/') : specifier.startsWith('@/') ? specifier.slice(2) : null;
    const targetFeature = resolved === null ? undefined : /^features\/([^/]+)(?:\/|$)/.exec(resolved)?.[1];
    return targetFeature && (isShared || sourceFeature !== targetFeature) ? [`${from} -> ${specifier}`] : [];
  });
}
