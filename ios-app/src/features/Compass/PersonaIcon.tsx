import { SvgXml } from 'react-native-svg';
import data from './source-icons.json';
import { array, record, text } from '../../platform/validation';
import { useTheme } from '../../ui/theme';
const tags = new Set(['path', 'circle', 'rect', 'line', 'ellipse', 'polygon', 'polyline']);
const attributes = new Set(['d', 'x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r', 'x1', 'x2', 'y1', 'y2', 'points', 'transform']);
const escapeXml = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function personaIconXml(name: string | undefined, color: string): string {
  if (!/^#[0-9a-f]{3,8}$/i.test(color)) throw new Error('لون الأيقونة غير صالح');
  const nodes = data[name as keyof typeof data] ?? data.Shield;
  const elements = nodes.map(value => { const [rawTag, rawAttributes] = array(value); const tag = text(rawTag); if (!tags.has(tag)) throw new Error('شكل الأيقونة غير صالح'); const props = record(rawAttributes); return `<${tag} ${Object.entries(props).filter(([key]) => attributes.has(key)).map(([key, attributeValue]) => `${key}="${escapeXml(String(attributeValue))}"`).join(' ')} />`; }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${elements}</svg>`;
}
export function PersonaIcon({ name, size = 32 }: { name?: string; size?: number }): React.JSX.Element { const { colors } = useTheme(); return <SvgXml xml={personaIconXml(name, colors.accent)} width={size} height={size} accessible={false} />; }
// PORT NOTE: Exact ten Lucide1.37.0 source icon nodes were extracted from the package pinned in repository bun.lock, with SHA512 integrity checked. See LUCIDE-LICENSE.txt.
// PORT STATUS: source resources/js/Domain/compass/SpectrumIcon.tsx; confidence high; todos 0.
