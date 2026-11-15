import { expect, test } from 'bun:test';
import governorateRows from '../../../../resources/data/governorates.json';
import { widgets, type ConfigField, type WidgetDefinition } from './model';
interface Original { id: string; name: string; category: WidgetDefinition['category']; defaultSize: { w: number; h: number }; minSize: { w: number; h: number }; maxSize: { w: number; h: number }; multiple: boolean; seed: { order: number; w: number; h: number } | null; fields: ConfigField[] }
test('all fourteen native declarations match unchanged website sizes, fields, multiplicity and seed placement', async () => {
  const cities = governorateRows.slice().sort((a, b) => a.picker_order - b.picker_order).map(row => ({ value: row.id, label: row.name_ar }));
  for (const native of widgets) {
    const source = await Bun.file(new URL(`../../../../resources/js/Pages/Board/_widgets/${native.id}/index.ts`, import.meta.url)).text();
    const iconNames = /import \{([^}]+)\} from 'lucide-react'/.exec(source)?.[1]?.split(',').map(name => name.trim()) ?? [];
    const declaration = /export default (\w+);/.exec(source)?.[1];
    if (!declaration) throw new Error(`No source declaration for ${native.id}`);
    const script = new Bun.Transpiler({ loader: 'ts' }).transformSync(source).replace(/^import[\s\S]*?;\s*/gm, '').replace(/^export default \w+;\s*/gm, '').replace(/^export /gm, '');
    const stubs = `${iconNames.map(name => `const ${name} = null;`).join('\n')}\nconst sources = new Proxy({}, {get: () => null}); const governorateOptions = () => cities; const GOVERNORATES_BY_ID = {};`;
    const original = new Function('cities', `${stubs}\n${script}\nreturn ${declaration};`)(cities) as Original;
    expect(native).toEqual({ id: original.id, name: original.name, category: original.category, defaultSize: [original.defaultSize.w, original.defaultSize.h], min: [original.minSize.w, original.minSize.h], max: [original.maxSize.w, original.maxSize.h], multiple: original.multiple, seed: original.seed, fields: original.fields });
  }
});
