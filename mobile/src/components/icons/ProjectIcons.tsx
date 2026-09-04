import { Image, type ImageSource } from 'expo-image';
import type { ComponentType, ReactNode } from 'react';
import Svg, {
  Circle,
  Ellipse,
  Line,
  Path,
  Polygon,
  Rect,
} from 'react-native-svg';

import { useAppTheme } from '@/contexts/ThemeContext';

export interface FeatureIconProps {
  color?: string;
  size?: number;
}

export type FeatureIcon = ComponentType<FeatureIconProps>;

interface Ink {
  accent: string;
  fill: (light: string, dark: string) => { fill: string; fillOpacity?: number };
  stroke: (
    light: string,
    dark: string,
  ) => { stroke: string; strokeOpacity?: number };
}

// Colors are written exactly as the web icons' Tailwind classes: a light and a
// dark hex, where "#RRGGBB/15" carries the alpha suffix as a percentage.
function ink(isDark: boolean, accent: string): Ink {
  const pick = (light: string, dark: string) => {
    const [color = '', alpha] = (isDark ? dark : light).split('/');
    return [color, alpha ? Number(alpha) / 100 : undefined] as const;
  };
  return {
    accent,
    fill: (light, dark) => {
      const [fill, fillOpacity] = pick(light, dark);
      return { fill, fillOpacity };
    },
    stroke: (light, dark) => {
      const [stroke, strokeOpacity] = pick(light, dark);
      return { stroke, strokeOpacity };
    },
  };
}

function projectIcon(
  name: string,
  draw: (ink: Ink) => ReactNode,
): FeatureIcon {
  function Icon({ color, size = 28 }: FeatureIconProps) {
    const { theme } = useAppTheme();
    return (
      <Svg
        accessibilityElementsHidden
        fill="none"
        height={size}
        importantForAccessibility="no-hide-descendants"
        viewBox="0 0 32 32"
        width={size}
      >
        {draw(ink(theme.isDark, color ?? theme.palette.primary))}
      </Svg>
    );
  }
  Icon.displayName = name;
  return Icon;
}

function imageIcon(name: string, source: ImageSource | number): FeatureIcon {
  function Icon({ size = 28 }: FeatureIconProps) {
    return (
      <Image
        accessibilityElementsHidden
        contentFit="contain"
        importantForAccessibility="no-hide-descendants"
        source={source}
        style={{ height: size, width: size }}
      />
    );
  }
  Icon.displayName = name;
  return Icon;
}

export const SyOfficialIcon = projectIcon('SyOfficialIcon', (ink) => (
  <>
    <Path
      d="M16 3L5 7v9c0 7.2 4.7 13.9 11 16 6.3-2.1 11-8.8 11-16V7L16 3z"
      {...ink.fill('#3B82F6/15', '#60A5FA/25')}
      {...ink.stroke('#2563EB', '#60A5FA')}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
    />
    <Path
      d="M11 16l3.5 3.5L21 11"
      {...ink.stroke('#10B981', '#34D399')}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2.5}
    />
    <Circle cx={21} cy={11} fill={ink.accent} r={2} />
  </>
));

export const RoznamaIcon = projectIcon('RoznamaIcon', (ink) => (
  <>
    <Rect
      height={22}
      rx={4}
      width={24}
      x={4}
      y={6}
      {...ink.fill('#EF4444/10', '#FB7185/20')}
      {...ink.stroke('#E11D48', '#FB7185')}
      strokeWidth={2}
    />
    <Path d="M4 12h24" {...ink.stroke('#EF4444', '#FB7185')} strokeWidth={2} />
    <Path
      d="M9 3v5M23 3v5"
      {...ink.stroke('#3B82F6', '#60A5FA')}
      strokeLinecap="round"
      strokeWidth={2.5}
    />
    <Circle cx={10} cy={18} r={1.5} {...ink.fill('#10B981', '#34D399')} />
    <Circle cx={16} cy={18} r={1.5} {...ink.fill('#F59E0B', '#FBBF24')} />
    <Circle cx={22} cy={18} r={1.5} {...ink.fill('#3B82F6', '#60A5FA')} />
    <Circle cx={10} cy={23} r={1.5} {...ink.fill('#8B5CF6', '#C084FC')} />
    <Circle cx={16} cy={23} fill={ink.accent} r={2} />
    <Circle cx={22} cy={23} r={1.5} {...ink.fill('#06B6D4', '#22D3EE')} />
  </>
));

export const PhonebookIcon = projectIcon('PhonebookIcon', (ink) => (
  <>
    <Rect
      height={24}
      rx={3}
      width={20}
      x={6}
      y={4}
      {...ink.fill('#F59E0B/15', '#FBBF24/20')}
      {...ink.stroke('#D97706', '#FBBF24')}
      strokeWidth={2}
    />
    <Path d="M6 9h20" {...ink.stroke('#059669', '#34D399')} strokeWidth={2} />
    <Circle
      cx={16}
      cy={16}
      r={3.5}
      {...ink.fill('#10B981/25', '#34D399/30')}
      {...ink.stroke('#059669', '#34D399')}
      strokeWidth={2}
    />
    <Path
      d="M11 24c0-2.8 2.2-5 5-5s5 2.2 5 5"
      {...ink.stroke('#374151', '#E2E8F0')}
      strokeLinecap="round"
      strokeWidth={2}
    />
    <Path
      d="M2 8v3M2 15v3M2 22v3"
      stroke={ink.accent}
      strokeLinecap="round"
      strokeWidth={2.5}
    />
  </>
));

export const SyIdIcon = projectIcon('SyIdIcon', (ink) => (
  <>
    <Circle
      cx={12}
      cy={12}
      r={7}
      {...ink.fill('#EC4899/20', '#F472B6/30')}
      {...ink.stroke('#DB2777', '#F472B6')}
      strokeWidth={2}
    />
    <Circle
      cx={20}
      cy={12}
      r={7}
      {...ink.fill('#3B82F6/20', '#60A5FA/30')}
      {...ink.stroke('#2563EB', '#60A5FA')}
      strokeWidth={2}
    />
    <Path
      d="M6 26l7.5-7.5"
      {...ink.stroke('#8B5CF6', '#C084FC')}
      strokeLinecap="round"
      strokeWidth={2.5}
    />
    <Circle cx={16} cy={20} fill={ink.accent} r={3} />
  </>
));

export const PartyIcon = projectIcon('PartyIcon', (ink) => (
  <>
    <Circle
      cx={11}
      cy={11}
      r={4}
      {...ink.fill('#8B5CF6/25', '#A78BFA/30')}
      {...ink.stroke('#7C3AED', '#A78BFA')}
      strokeWidth={2}
    />
    <Circle
      cx={21}
      cy={11}
      r={4}
      {...ink.fill('#F97316/25', '#FB923C/30')}
      {...ink.stroke('#EA580C', '#FB923C')}
      strokeWidth={2}
    />
    <Path
      d="M4 25c0-3.9 3.1-7 7-7s7 3.1 7 7"
      {...ink.stroke('#7C3AED', '#A78BFA')}
      strokeLinecap="round"
      strokeWidth={2}
    />
    <Path
      d="M17 25c0-3.1 2.2-5.7 5.2-6.6M14 25h14"
      {...ink.stroke('#EA580C', '#FB923C')}
      strokeLinecap="round"
      strokeWidth={2}
    />
    <Circle cx={16} cy={18} fill={ink.accent} r={2} />
  </>
));

export const TierlistIcon = projectIcon('TierlistIcon', (ink) => (
  <>
    <Rect
      height={6}
      opacity={0.9}
      rx={2}
      width={24}
      x={4}
      y={5}
      {...ink.fill('#F59E0B', '#FBBF24')}
    />
    <Rect
      height={6}
      opacity={0.85}
      rx={2}
      width={24}
      x={4}
      y={13}
      {...ink.fill('#3B82F6', '#60A5FA')}
    />
    <Rect
      height={6}
      opacity={0.85}
      rx={2}
      width={24}
      x={4}
      y={21}
      {...ink.fill('#10B981', '#34D399')}
    />
    <Path
      d="M8 8h6M8 16h10M8 24h14"
      {...ink.stroke('#FFFFFF', '#0F172A')}
      strokeLinecap="round"
      strokeWidth={2}
    />
    <Circle cx={25} cy={8} fill={ink.accent} r={1.5} />
  </>
));

export const HouseIcon = projectIcon('HouseIcon', (ink) => (
  <>
    <Path
      d="M16 3L3 10v3h26v-3L16 3z"
      {...ink.fill('#0284C7/25', '#38BDF8/30')}
      {...ink.stroke('#0284C7', '#38BDF8')}
      strokeLinejoin="round"
      strokeWidth={2}
    />
    <Path
      d="M6 13v11M11 13v11M16 13v11M21 13v11M26 13v11"
      {...ink.stroke('#64748B', '#CBD5E1')}
      strokeLinecap="round"
      strokeWidth={2}
    />
    <Path
      d="M3 24h26v4H3v-4z"
      {...ink.fill('#475569/20', '#94A3B8/30')}
      {...ink.stroke('#475569', '#94A3B8')}
      strokeWidth={2}
    />
    <Circle cx={16} cy={7} fill={ink.accent} r={1.8} />
  </>
));

export const CompassIcon = projectIcon('CompassIcon', (ink) => (
  <>
    <Circle
      cx={16}
      cy={16}
      r={13}
      {...ink.fill('#06B6D4/10', '#22D3EE/20')}
      {...ink.stroke('#0891B2', '#22D3EE')}
      strokeWidth={2}
    />
    <Polygon points="16,6 20,16 16,16" {...ink.fill('#EF4444', '#F87171')} />
    <Polygon points="16,26 12,16 16,16" {...ink.fill('#3B82F6', '#60A5FA')} />
    <Polygon points="6,16 16,12 16,16" {...ink.fill('#F59E0B', '#FBBF24')} />
    <Polygon points="26,16 16,20 16,16" {...ink.fill('#10B981', '#34D399')} />
    <Circle
      cx={16}
      cy={16}
      fill={ink.accent}
      r={2.5}
      {...ink.stroke('#FFFFFF', '#0F172A')}
      strokeWidth={1}
    />
  </>
));

export const PrioritiesIcon = projectIcon('PrioritiesIcon', (ink) => (
  <>
    <Path
      d="M5 8h22"
      {...ink.stroke('#3B82F6', '#60A5FA')}
      strokeLinecap="round"
      strokeWidth={2}
    />
    <Path
      d="M5 16h22"
      {...ink.stroke('#10B981', '#34D399')}
      strokeLinecap="round"
      strokeWidth={2}
    />
    <Path
      d="M5 24h22"
      {...ink.stroke('#F59E0B', '#FBBF24')}
      strokeLinecap="round"
      strokeWidth={2}
    />
    <Circle
      cx={11}
      cy={8}
      r={3.5}
      {...ink.fill('#3B82F6', '#60A5FA')}
      {...ink.stroke('#FFFFFF', '#0F172A')}
      strokeWidth={1.5}
    />
    <Circle
      cx={21}
      cy={16}
      r={3.5}
      {...ink.fill('#10B981', '#34D399')}
      {...ink.stroke('#FFFFFF', '#0F172A')}
      strokeWidth={1.5}
    />
    <Circle
      cx={14}
      cy={24}
      fill={ink.accent}
      r={3.5}
      {...ink.stroke('#FFFFFF', '#0F172A')}
      strokeWidth={1.5}
    />
  </>
));

export const SitesIcon = projectIcon('SitesIcon', (ink) => (
  <>
    <Path
      d="M10 18l-3 3a4.24 4.24 0 01-6-6l3-3a4.24 4.24 0 016 0"
      {...ink.stroke('#6366F1', '#818CF8')}
      strokeLinecap="round"
      strokeWidth={2.5}
    />
    <Path
      d="M22 14l3-3a4.24 4.24 0 016 6l-3 3a4.24 4.24 0 01-6 0"
      {...ink.stroke('#10B981', '#34D399')}
      strokeLinecap="round"
      strokeWidth={2.5}
    />
    <Line
      stroke={ink.accent}
      strokeLinecap="round"
      strokeWidth={3}
      x1={12}
      x2={20}
      y1={20}
      y2={12}
    />
  </>
));

export const PopulationIcon = projectIcon('PopulationIcon', (ink) => (
  <>
    <Circle
      cx={16}
      cy={16}
      r={13}
      {...ink.fill('#10B981/15', '#34D399/25')}
      {...ink.stroke('#059669', '#34D399')}
      strokeWidth={2}
    />
    <Ellipse
      cx={16}
      cy={16}
      rx={13}
      ry={5}
      {...ink.stroke('#3B82F6', '#60A5FA')}
      strokeWidth={2}
    />
    <Path
      d="M16 3v26"
      {...ink.stroke('#059669', '#34D399')}
      strokeLinecap="round"
      strokeWidth={2}
    />
    <Circle cx={16} cy={16} fill={ink.accent} r={2.5} />
  </>
));

export const GovAppsIcon = projectIcon('GovAppsIcon', (ink) => (
  <>
    <Rect
      height={26}
      rx={3}
      width={16}
      x={8}
      y={3}
      {...ink.fill('#475569/15', '#94A3B8/20')}
      {...ink.stroke('#334155', '#94A3B8')}
      strokeWidth={2}
    />
    <Path
      d="M14 6h4"
      {...ink.stroke('#64748B', '#CBD5E1')}
      strokeLinecap="round"
      strokeWidth={2}
    />
    <Rect height={4} rx={1} width={4} x={11} y={10} {...ink.fill('#3DDC84', '#4ADE80')} />
    <Rect height={4} rx={1} width={4} x={17} y={10} {...ink.fill('#3B82F6', '#60A5FA')} />
    <Rect height={4} rx={1} width={4} x={11} y={16} {...ink.fill('#F59E0B', '#FBBF24')} />
    <Rect fill={ink.accent} height={4} rx={1} width={4} x={17} y={16} />
    <Circle cx={16} cy={24} r={1.5} {...ink.fill('#64748B', '#94A3B8')} />
  </>
));

export const TransitIcon = projectIcon('TransitIcon', (ink) => (
  <>
    <Rect
      height={19}
      rx={4}
      width={20}
      x={6}
      y={5}
      {...ink.fill('#EAB308/20', '#FACC15/25')}
      {...ink.stroke('#CA8A04', '#FACC15')}
      strokeWidth={2}
    />
    <Path d="M6 13h20" {...ink.stroke('#2563EB', '#60A5FA')} strokeWidth={2} />
    <Circle cx={10} cy={18} r={2} {...ink.fill('#2563EB', '#60A5FA')} />
    <Circle cx={22} cy={18} r={2} {...ink.fill('#2563EB', '#60A5FA')} />
    <Path
      d="M9 24v4M23 24v4"
      {...ink.stroke('#334155', '#CBD5E1')}
      strokeLinecap="round"
      strokeWidth={2.5}
    />
    <Circle cx={16} cy={9} fill={ink.accent} r={1.5} />
  </>
));

export const JusticeIcon = projectIcon('JusticeIcon', (ink) => (
  <>
    <Path
      d="M16 3v24M8 27h16"
      {...ink.stroke('#B45309', '#F59E0B')}
      strokeLinecap="round"
      strokeWidth={2}
    />
    <Path
      d="M6 9h20"
      {...ink.stroke('#F59E0B', '#FBBF24')}
      strokeLinecap="round"
      strokeWidth={2.5}
    />
    <Path
      d="M6 9l-3 7a4 4 0 008 0L6 9z"
      {...ink.fill('#F59E0B/25', '#FBBF24/30')}
      {...ink.stroke('#D97706', '#FBBF24')}
      strokeWidth={1.5}
    />
    <Path
      d="M26 9l-3 7a4 4 0 008 0l-5-7z"
      {...ink.fill('#F59E0B/25', '#FBBF24/30')}
      {...ink.stroke('#D97706', '#FBBF24')}
      strokeWidth={1.5}
    />
    <Circle cx={16} cy={9} fill={ink.accent} r={2} />
  </>
));

export const MishwarIcon = projectIcon('MishwarIcon', (ink) => (
  <>
    <Path
      d="M16 3C10.5 3 6 7.5 6 13c0 7.5 10 16 10 16s10-8.5 10-16c0-5.5-4.5-10-10-10z"
      {...ink.fill('#EF4444/20', '#F87171/30')}
      {...ink.stroke('#DC2626', '#F87171')}
      strokeLinejoin="round"
      strokeWidth={2}
    />
    <Circle
      cx={16}
      cy={13}
      fill={ink.accent}
      r={3.5}
      {...ink.stroke('#FFFFFF', '#0F172A')}
      strokeWidth={1.5}
    />
  </>
));

export const BoardIcon = projectIcon('BoardIcon', (ink) => (
  <>
    <Rect
      height={10}
      opacity={0.9}
      rx={2}
      width={10}
      x={4}
      y={4}
      {...ink.fill('#8B5CF6', '#A78BFA')}
    />
    <Rect
      height={14}
      opacity={0.9}
      rx={2}
      width={10}
      x={18}
      y={4}
      {...ink.fill('#06B6D4', '#22D3EE')}
    />
    <Rect
      height={10}
      opacity={0.9}
      rx={2}
      width={10}
      x={4}
      y={18}
      {...ink.fill('#3B82F6', '#60A5FA')}
    />
    <Rect fill={ink.accent} height={6} rx={2} width={10} x={18} y={22} />
  </>
));

export const RecipesIcon = projectIcon('RecipesIcon', (ink) => (
  <>
    <Rect
      height={24}
      rx={3}
      width={22}
      x={5}
      y={4}
      {...ink.fill('#F97316/15', '#FB923C/25')}
      {...ink.stroke('#EA580C', '#FB923C')}
      strokeWidth={2}
    />
    <Path
      d="M5 4v24"
      {...ink.stroke('#C2410C', '#F97316')}
      strokeLinecap="round"
      strokeWidth={3}
    />
    <Path
      d="M12 17h8v2h-8v-2zm0 0c-1.2 0-2-.8-2-1.8 0-.6.3-1.2.8-1.5.3-.2.4-.6.3-1-.2-.5-.1-1.1.3-1.5.4-.4 1-.5 1.5-.3.4.1.8 0 1-.3.5-.7 1.3-1.1 2.1-1.1s1.6.4 2.1 1.1c.2.3.6.4 1 .3.5-.2 1.1-.1 1.5.3.4.4.5 1 .3 1.5-.1.4 0 .8.3 1 .5.3.8.9.8 1.5 0 1-.8 1.8-2 1.8"
      {...ink.fill('#10B981/10', '#34D399/20')}
      {...ink.stroke('#10B981', '#34D399')}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.6}
    />
    <Path
      d="M22 4v6l-2-1.5L18 10V4"
      {...ink.fill('#EF4444', '#F87171')}
      {...ink.stroke('#DC2626', '#EF4444')}
      strokeWidth={1}
    />
    <Circle cx={16} cy={22} fill={ink.accent} r={1.5} />
  </>
));

export const NewsIcon = projectIcon('NewsIcon', (ink) => (
  <>
    <Rect
      height={22}
      rx={3}
      width={24}
      x={4}
      y={5}
      {...ink.fill('#0284C7/15', '#38BDF8/25')}
      {...ink.stroke('#0284C7', '#38BDF8')}
      strokeWidth={2}
    />
    <Path
      d="M8 10h16"
      {...ink.stroke('#EF4444', '#F87171')}
      strokeLinecap="round"
      strokeWidth={2.5}
    />
    <Path
      d="M8 15h10M8 19h10M8 23h7"
      {...ink.stroke('#334155', '#CBD5E1')}
      strokeLinecap="round"
      strokeWidth={2}
    />
    <Rect height={8} rx={1} width={4} x={20} y={15} {...ink.fill('#0284C7', '#38BDF8')} />
    <Circle cx={22} cy={19} fill={ink.accent} r={1} />
  </>
));

export const AnswersIcon = projectIcon('AnswersIcon', (ink) => (
  <>
    <Path
      d="M27 15c0 6.1-5 11-11 11-1.8 0-3.5-.4-5-1.2L4 27l2.4-6.8C5.5 18.7 5 16.9 5 15 5 8.9 9.9 4 16 4s11 4.9 11 11z"
      {...ink.fill('#3B82F6/15', '#60A5FA/25')}
      {...ink.stroke('#2563EB', '#60A5FA')}
      strokeLinejoin="round"
      strokeWidth={2}
    />
    <Path
      d="M16 10v5"
      {...ink.stroke('#F59E0B', '#FBBF24')}
      strokeLinecap="round"
      strokeWidth={2.5}
    />
    <Circle cx={16} cy={19.5} fill={ink.accent} r={1.5} />
  </>
));

export const CodexCommunityIcon = projectIcon('CodexCommunityIcon', (ink) => (
  <>
    <Path
      d="M26 21c0 3.3-4.5 6-10 6s-10-2.7-10-6V11c0-3.3 4.5-6 10-6s10 2.7 10 6v10z"
      {...ink.fill('#8B5CF6/15', '#A78BFA/25')}
      {...ink.stroke('#7C3AED', '#A78BFA')}
      strokeWidth={2}
    />
    <Path
      d="M11 13l-4 3 4 3"
      {...ink.stroke('#10B981', '#34D399')}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
    />
    <Path
      d="M21 13l4 3-4 3"
      {...ink.stroke('#10B981', '#34D399')}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
    />
    <Path
      d="M17 12l-2 8"
      stroke={ink.accent}
      strokeLinecap="round"
      strokeWidth={2.5}
    />
  </>
));

// Native only: the emergency alerts section has no web counterpart yet.
export const WarningsIcon = projectIcon('WarningsIcon', (ink) => (
  <>
    <Path
      d="M16 4L3 27h26L16 4z"
      {...ink.fill('#EF4444/15', '#F87171/25')}
      {...ink.stroke('#DC2626', '#F87171')}
      strokeLinejoin="round"
      strokeWidth={2}
    />
    <Path
      d="M16 12v7"
      {...ink.stroke('#F59E0B', '#FBBF24')}
      strokeLinecap="round"
      strokeWidth={2.5}
    />
    <Circle cx={16} cy={23} fill={ink.accent} r={1.8} />
  </>
));

const quickLinkIcons: Readonly<Record<string, FeatureIcon>> = {
  answers: AnswersIcon,
  'codex-community': CodexCommunityIcon,
  'flag-replacer': imageIcon(
    'FlagReplacerIcon',
    require('../../../assets/images/flag-replacer.svg'),
  ),
  jard: imageIcon('JardIcon', { uri: 'https://jard.chat/images/logo-light.svg' }),
  joory: imageIcon('JooryIcon', { uri: 'https://joory.chat/favicon.svg' }),
  news: NewsIcon,
  recipes: RecipesIcon,
};

export function quickLinkIcon(id: string): FeatureIcon | null {
  return quickLinkIcons[id] ?? null;
}

/*
PORT STATUS
  source:     resources/js/Components/Icons/ProjectIcons.tsx (316 lines)
  confidence: high
  todos:      0
  notes:      Same viewBox, paths, stroke widths and caps as the web icons; the Tailwind light/dark colors and alpha suffixes resolve from the app theme and the accent color replaces hsl(var(--primary)). WarningsIcon is native only. Quick-link art for joory, jard and the flag replacer is drawn with expo-image, as the website uses plain images there.
*/
