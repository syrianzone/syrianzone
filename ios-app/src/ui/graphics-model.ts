import catalogue from '../../../resources/data/project-icons.json';

type Drawing = { viewBox: string; body: string } | { alias: string };
const drawings: Readonly<Record<string, Drawing>> = catalogue.icons;

export function hasProjectIcon(name: string): boolean { return Object.hasOwn(drawings, name); }

export function projectIconXml(name: string, mode: 'light' | 'dark', accent: string): string {
  const seen = new Set<string>();
  let drawing = drawings[name];
  while (drawing && 'alias' in drawing) {
    if (seen.has(drawing.alias)) throw new Error('Project icon alias cycle');
    seen.add(drawing.alias);
    drawing = drawings[drawing.alias];
  }
  if (!drawing) throw new Error(`Unknown project icon: ${name}`);
  const body = drawing.body.replace(/\sclass="([^"]*)"/g, (_match: string, classes: string) => {
    const attributes = new Map<string, string>();
    const tokens = classes.split(/\s+/);
    for (const dark of [false, true]) {
      if (dark && mode !== 'dark') continue;
      for (const token of tokens) {
        if (token.startsWith('dark:') !== dark) continue;
        const utility = dark ? token.slice(5) : token;
        const color = /^(fill|stroke)-\[(#[0-9A-Fa-f]{3,8})\](?:\/(\d+))?$/.exec(utility);
        if (!color?.[1] || !color[2]) throw new Error(`Unsupported project icon CSS: ${token}`);
        attributes.set(color[1], color[2]);
        if (color[3]) attributes.set(`${color[1]}-opacity`, String(Number(color[3]) / 100));
        else attributes.delete(`${color[1]}-opacity`);
      }
    }
    return Array.from(attributes, ([key, value]) => ` ${key}="${value}"`).join('');
  }).replace(/hsl\(var\(--primary\)\)|currentColor/g, accent);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${drawing.viewBox}" fill="none" color="${accent}">${body}</svg>`;
}
