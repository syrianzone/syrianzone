import { SvgXml } from 'react-native-svg';
import icons from './sector-icons.json';
import { useTheme } from '../../ui/theme';
import { array, record, text } from '../../platform/validation';
const escapeXml = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function SectorIcon({ name, size = 24 }: { name: string | null; size?: number }): React.JSX.Element {
  const { colors } = useTheme(); const nodes = icons[name as keyof typeof icons] ?? icons['circle-ellipsis'];
  const content = nodes.map(node => { const [rawTag, rawAttributes] = array(node); const tag = text(rawTag); const attributes = record(rawAttributes); if (!['path', 'circle', 'rect', 'line', 'ellipse', 'polygon', 'polyline'].includes(tag)) throw new Error('شكل رمز القطاع غير صالح'); return `<${tag} ${Object.entries(attributes).filter(([key]) => ['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height', 'x1', 'x2', 'y1', 'y2', 'points'].includes(key)).map(([key, value]) => `${key}="${escapeXml(String(value))}"`).join(' ')} />`; }).join('');
  return <SvgXml xml={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${colors.accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${content}</svg>`} width={size} height={size} accessible={false} />;
}
export const SECTOR_ICONS = { zap: 'برق (طاقة)', wallet: 'محفظة (رواتب)', 'shopping-cart': 'عربة تسوّق (أسعار)', house: 'منزل (سكن)', droplets: 'قطرات (مياه وخدمات)', bus: 'حافلة (نقل)', landmark: 'مبنى (اقتصاد)', wifi: 'شبكة (اتصالات)', 'heart-pulse': 'نبض (صحة)', 'graduation-cap': 'قبعة تخرّج (تعليم)', scale: 'ميزان (حوكمة)', users: 'أشخاص (عودة ونزوح)', 'circle-ellipsis': 'نقاط (أخرى)' };
// PORT NOTE: Exact Lucide1.37.0 nodes from the lockfile-pinned npm archive. Its SHA512 integrity was verified before extraction. See LUCIDE-LICENSE.txt.
// PORT STATUS: source Domain/promises/status.ts sector icons; confidence high; todos 0.
