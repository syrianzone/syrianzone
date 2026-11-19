import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { SvgXml, Text as SvgText } from 'react-native-svg';
import { ayahArtwork } from './ayah-artwork.generated';
import { hasProjectIcon, projectIconXml } from './graphics-model';
import { useTheme } from './theme';

export function ProjectIcon({ name, size = 32 }: { name: string; size?: number }): React.JSX.Element | null {
  const { mode, colors } = useTheme();
  const xml = useMemo(() => hasProjectIcon(name) ? projectIconXml(name, mode, colors.accent) : null, [name, mode, colors.accent]);
  return xml ? <SvgXml xml={xml} width={size} height={size} accessible={false} /> : null;
}

export function AyahMark({ digits, width = 28 }: { digits: string; width?: number }): React.JSX.Element {
  const height = width / ayahArtwork.aspect;
  return <View accessible={false} style={{ width, height }}>
    <SvgXml xml={ayahArtwork.xml} width={width} height={height} />
    <Svg width={width} height={height} viewBox={ayahArtwork.viewBox} style={{ position: 'absolute', top: 0, start: 0 }}>
      <SvgText x={ayahArtwork.slot.cx} y={ayahArtwork.slot.cy + ayahArtwork.slot.h * 0.34} fontSize={ayahArtwork.slot.h} fill="#083a3a" textAnchor="middle">{digits}</SvgText>
    </Svg>
  </View>;
}
