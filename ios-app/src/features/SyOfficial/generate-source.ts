import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { resolveSvgCss } from '../../platform/original-svg';

const root = resolve(import.meta.dir, '../../../..');
const path = 'resources/js/Pages/SyOfficial/Index.tsx';
const source = readFileSync(resolve(root, path), 'utf8');
const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function strings(node: ts.Expression): unknown {
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.map(property => {
    if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) throw new Error('Invalid original translation property');
    return [property.name.text, strings(property.initializer)];
  }));
  throw new Error('Original translations must remain literal data');
}
let translations: unknown;
for (const statement of ast.statements) if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
  if (ts.isIdentifier(declaration.name) && declaration.name.text === 'TRANSLATIONS' && declaration.initializer) translations = strings(declaration.initializer);
}
if (!translations) throw new Error('Missing original directory translations');
const literal = (value: unknown): string => JSON.stringify(value).replace(/[\u2013\u2014]/g, character => `\\u${character.charCodeAt(0).toString(16)}`);
writeFileSync(resolve(import.meta.dir, 'translations.generated.ts'), '// Generated from original directory translations by generate-source.ts. Do not edit.\nexport const translations = '+literal(translations)+' as const;\nexport const translationSource = '+literal({ path, sha256: createHash('sha256').update(source).digest('hex') })+';\n');

const iconPath = 'resources/js/Components/ui/icons.tsx';
const iconsSource = readFileSync(resolve(root, iconPath), 'utf8');
const iconNames = { facebook: 'Facebook', instagram: 'Instagram', twitter: 'Twitter', linkedin: 'Linkedin', youtube: 'Youtube' };
const icons = Object.fromEntries(Object.entries(iconNames).map(([key, name]) => {
  const declaration = iconsSource.split(`export const ${name} =`)[1];
  const body = declaration?.match(/<svg\b[^>]*>([\s\S]*?)<\/svg>/)?.[1];
  if (!body || /[{}]/.test(body)) throw new Error(`Original ${name} icon is not literal SVG`);
  return [key, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body.trim()}</svg>`];
}));
const flags = Object.fromEntries(['ar', 'en', 'tr', 'ku'].map(language => [language, resolveSvgCss(readFileSync(resolve(root, `public/assets/${language}.svg`), 'utf8'))]));
writeFileSync(resolve(import.meta.dir, 'graphics.generated.ts'), '// Generated from original social icons and language flags by generate-source.ts. Do not edit.\nexport const socialIcons: Record<string,string> = '+literal(icons)+';\nexport const languageFlags: Record<string,string> = '+literal(flags)+';\nexport const socialIconSource = '+literal({ path: iconPath, sha256: createHash('sha256').update(iconsSource).digest('hex') })+';\n');
