interface Rule { classes: string[]; values: Record<string, string> }
function declarations(source: string): Record<string, string> {
  return Object.fromEntries(source.split(';').map(item => item.split(':').map(value => value.trim())).filter(parts => parts.length === 2 && parts[0]).map(parts => [parts[0]!, parts[1]!.replace(/(-?\d*\.?\d+)px\b/g, '$1')]));
}
// These checked-in artworks use class selectors only. Unknown CSS fails conversion instead of silently dropping a visual rule.
export function resolveSvgCss(source: string): string {
  const rules: Rule[] = [];
  let xml = source.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_block, css: string) => {
    const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const match of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selectors = match[1]!.split(',').map(value => value.trim());
      if (selectors.some(value => !/^\.[\w-]+$/.test(value))) throw new Error(`Unsupported artwork selector: ${match[1]}`);
      rules.push({ classes: selectors.map(value => value.slice(1)), values: declarations(match[2]!) });
    }
    return '';
  });
  xml = xml.replace(/<([A-Za-z][\w:-]*)([^<>]*?)\s*(\/?)>/g, (tag, name: string, raw: string, close: string) => {
    const classes = /\bclass="([^"]*)"/.exec(raw)?.[1]?.split(/\s+/) ?? [];
    const inline = /\bstyle="([^"]*)"/.exec(raw)?.[1] ?? '';
    if (!classes.length && !inline) return tag;
    const values: Record<string, string> = {};
    for (const rule of rules) if (rule.classes.some(key => classes.includes(key))) Object.assign(values, rule.values);
    Object.assign(values, declarations(inline));
    let attrs = raw.replace(/\s+(?:class|style)="[^"]*"/g, '');
    for (const [key, value] of Object.entries(values)) {
      if (!/^[\w-]+$/.test(key) || /["<>]/.test(value)) throw new Error('Unsupported artwork attribute');
      attrs = attrs.replace(new RegExp(`\\s+${key}="[^"]*"`, 'g'), '');
      attrs += ` ${key}="${value}"`;
    }
    return `<${name}${attrs}${close}>`;
  });
  xml = xml.replace(/<\?xml[\s\S]*?\?>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<color-profile\b[^>]*\/>/g, '');
  return xml.replace(/<svg\b([^>]*)>/, (tag, attributes: string) => {
    if (/\bviewBox=/.test(attributes)) return tag;
    const width = /\bwidth="([\d.]+)(?:px)?"/.exec(attributes)?.[1];
    const height = /\bheight="([\d.]+)(?:px)?"/.exec(attributes)?.[1];
    if (!width || !height || !Number.isFinite(Number(width)) || !Number.isFinite(Number(height)) || Number(width) <= 0 || Number(height) <= 0) return tag;
    return tag.replace(/\s*\/?>$/, ending => ` viewBox="0 0 ${width} ${height}"${ending}`);
  });
}
export function recolorArtwork(xml: string, primary: string, background: string): string {
  return xml.replace(/#04018c/gi, primary).replace(/fill="#(?:fff|ffffff)"/gi, `fill="${background}"`);
}
// PORT STATUS: source public/syid-assets/icons/governorates/with-frame SVG styles and Pages/SyId/SyidClient.tsx; confidence high; todos 0.
