import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ScrollView, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Label } from '../../components';
import { NativeIconAction } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import geometry from './geometry.json';
import { decodeGeometry, projectedPaths } from './model';

export const PROVINCES = decodeGeometry(geometry);
const PATHS = projectedPaths(PROVINCES);
// PORT NOTE: the original is a vector-only Leaflet map. UIScrollView supplies native pinch and pan over the unchanged shapes.
export function AtlasMap({ fill, label, selected, onSelect }: {
  fill(id: string): string; label(id: string): string; selected: readonly string[]; onSelect(id: string): void;
}): React.JSX.Element {
  const { colors, mode } = useTheme(); const ref = useRef<ComponentRef<typeof ScrollView>>(null);
  const [size, setSize] = useState({ width: 0, height: 0 }); const position = useRef({ x: 0, y: 0, scale: 1 });
  useEffect(() => { position.current = { x: 0, y: 0, scale: 1 }; ref.current?.scrollResponderZoomTo({ x: 0, y: 0, width: size.width, height: size.height, animated: false }); }, [size]);
  const zoom = (factor: number) => {
    const scale = Math.max(1, Math.min(6, position.current.scale * factor));
    const width = size.width / scale, height = size.height / scale;
    const centerX = (position.current.x + size.width / 2) / position.current.scale, centerY = (position.current.y + size.height / 2) / position.current.scale;
    ref.current?.scrollResponderZoomTo({ x: Math.max(0, Math.min(size.width - width, centerX - width / 2)), y: Math.max(0, Math.min(size.height - height, centerY - height / 2)), width, height, animated: true });
  };
  return <View style={{ gap: 10 }}><View style={{ height: 390, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: colors.separator, backgroundColor: mode === 'dark' ? '#121C28' : '#E1EBEF' }}
    onLayout={event => { const { width, height } = event.nativeEvent.layout; setSize(previous => previous.width === width && previous.height === height ? previous : { width, height }); }}>
    {size.width > 0 ? <ScrollView ref={ref} horizontal style={{ direction: 'ltr' }} minimumZoomScale={1} maximumZoomScale={6} bouncesZoom pinchGestureEnabled centerContent
      showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false} scrollEventThrottle={32}
      onScroll={event => { position.current = { x: event.nativeEvent.contentOffset.x, y: event.nativeEvent.contentOffset.y, scale: event.nativeEvent.zoomScale || 1 }; }}>
      <Svg width={size.width} height={size.height} viewBox="0 0 1000 850" accessibilityLabel="خريطة محافظات سوريا. كبّر بإصبعين أو استخدم أزرار التكبير. تتوفر القيم أيضاً في قائمة المحافظات.">
        {PATHS.map(path => <Path key={path.id} d={path.d} fill={fill(path.id)} fillRule="evenodd" fillOpacity={selected.includes(path.id) ? 1 : 0.75}
          stroke={selected.includes(path.id) ? colors.text : mode === 'dark' ? '#B7CDD5' : '#486572'} strokeWidth={selected.includes(path.id) ? 3.5 : 1.3}
          vectorEffect="non-scaling-stroke" accessible accessibilityLabel={`${label(path.id)}. اضغط لعرض البيانات.`} onPress={() => onSelect(path.id)} />)}
      </Svg>
    </ScrollView> : null}
    <View style={{ position: 'absolute', top: 12, end: 12, gap: 6 }}><NativeIconAction title="تكبير الخريطة" systemImage="plus.magnifyingglass" onPress={() => zoom(1.5)} />
      <NativeIconAction title="تصغير الخريطة" systemImage="minus.magnifyingglass" onPress={() => zoom(1 / 1.5)} />
      <NativeIconAction title="عرض سوريا كاملة" systemImage="arrow.up.left.and.arrow.down.right" onPress={() => ref.current?.scrollResponderZoomTo({ x: 0, y: 0, width: size.width, height: size.height, animated: true })} /></View>
  </View><Label secondary style={{ fontSize: 13 }}>كبّر الخريطة بإصبعين، واسحب للتنقل. اختر محافظة لعرض بياناتها، أو استخدم قائمة المحافظات.</Label></View>;
}
// PORT STATUS: source Population/components/map/MapClient.tsx, map-styles.ts and public/assets/population/syr_admin1_opt.geojson; confidence medium; todos 0.
