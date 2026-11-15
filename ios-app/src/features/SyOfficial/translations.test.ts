import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { translations } from './translations.generated';
import { languageFlags, socialIcons, socialIconSource } from './graphics.generated';
import { resolveSvgCss } from '../SyId/svg';

test('all four native directory languages preserve every original translation', () => {
  const source = readFileSync(new URL('../../../../resources/js/Pages/SyOfficial/Index.tsx', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('Index.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const original: Record<string, Record<string, string>> = {};
  for (const statement of ast.statements) if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
    if (!ts.isIdentifier(declaration.name) || declaration.name.text !== 'TRANSLATIONS' || !declaration.initializer || !ts.isObjectLiteralExpression(declaration.initializer)) continue;
    for (const language of declaration.initializer.properties) {
      if (!ts.isPropertyAssignment(language) || !ts.isIdentifier(language.name) || !ts.isObjectLiteralExpression(language.initializer)) throw new Error('Invalid source language');
      original[language.name.text] = Object.fromEntries(language.initializer.properties.map(property => {
        if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name) || !ts.isStringLiteral(property.initializer)) throw new Error('Invalid source translation');
        return [property.name.text, property.initializer.text];
      }));
    }
  }
  expect(Object.keys(original)).toEqual(['ar', 'en', 'tr', 'ku']);
  const actual: Record<string, Readonly<Record<string, string>>> = translations;
  expect(actual).toEqual(original);
  expect(translations.tr.searchPlaceholder).toBe('İsim veya açıklamaya göre resmi hesapları arayın...');
  expect(translations.ku.noResults).toBe('Tu hesabên fermî nehatin dîtin');
});
test('native brand icons and language flags retain their original vector geometry', () => {
  const source = readFileSync(new URL('../../../../resources/js/Components/ui/icons.tsx', import.meta.url), 'utf8');
  expect(createHash('sha256').update(source).digest('hex')).toBe(socialIconSource.sha256);
  const geometry = (value: string): string[] => value.match(/<(?:path|rect|circle|line|polygon)\b[^>]*\/>/g)?.map(shape => shape.replace(/\s+/g, ' ')) ?? [];
  for (const [key, name] of Object.entries({ facebook: 'Facebook', instagram: 'Instagram', twitter: 'Twitter', linkedin: 'Linkedin', youtube: 'Youtube' })) {
    const original = source.split(`export const ${name} =`)[1]?.split('</svg>')[0] ?? '';
    expect(geometry(socialIcons[key] ?? '')).toEqual(geometry(original));
    expect(geometry(socialIcons[key] ?? '').length).toBeGreaterThan(0);
  }
  for (const language of ['ar', 'en', 'tr', 'ku']) expect(languageFlags[language]).toBe(resolveSvgCss(readFileSync(new URL(`../../../../public/assets/${language}.svg`, import.meta.url), 'utf8')));
});
