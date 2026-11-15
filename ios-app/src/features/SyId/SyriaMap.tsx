import { useMemo, useRef } from 'react';
import { Animated, PanResponder, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { NativeAction } from '../../ui/native';
import { Label } from '../../components';
import { provinceDrawing, type Province } from './model';
// PORT NOTE: The source map has no basemap. Native SVG preserves its Mercator geometry and interior rings; gestures update a transform, not the path data.
export function SyriaMap({ provinces, onSelect }: { provinces: Province[]; onSelect(id: string): void }): React.JSX.Element {
  const drawing = useMemo(() => provinceDrawing(provinces), [provinces]);
  const scale = useRef(new Animated.Value(1)).current;
  const translate = useRef(new Animated.ValueXY()).current;
  const state = useRef({ scale: 1, x: 0, y: 0, initialScale: 1, initialX: 0, initialY: 0, distance: 0 });
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (event, gesture) => event.nativeEvent.touches.length > 1 || Math.max(Math.abs(gesture.dx), Math.abs(gesture.dy)) > 6,
    onPanResponderGrant: event => { const s = state.current; s.initialScale = s.scale; s.initialX = s.x; s.initialY = s.y; const [a, b] = event.nativeEvent.touches; s.distance = a && b ? Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) : 0; },
    onPanResponderMove: (event, gesture) => {
      const s = state.current; const [a, b] = event.nativeEvent.touches;
      if (a && b && s.distance > 0) { s.scale = Math.max(1, Math.min(8, s.initialScale * Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) / s.distance)); scale.setValue(s.scale); }
      else { s.x = Math.max(-600, Math.min(600, s.initialX + gesture.dx)); s.y = Math.max(-600, Math.min(600, s.initialY + gesture.dy)); translate.setValue({ x: s.x, y: s.y }); }
    }
  }), [scale, translate]);
  const zoom = (factor: number): void => { state.current.scale = Math.max(1, Math.min(8, state.current.scale * factor)); Animated.timing(scale, { toValue: state.current.scale, duration: 180, useNativeDriver: true }).start(); };
  const reset = (): void => { state.current.scale = 1; state.current.x = 0; state.current.y = 0; scale.setValue(1); translate.setValue({ x: 0, y: 0 }); };
  return <View style={{ gap: 10 }}><View {...pan.panHandlers} accessibilityLabel="خريطة المحافظات، اسحب للتحريك واقرص للتكبير" style={{ height: 420, backgroundColor: '#24292F', borderRadius: 18, overflow: 'hidden' }}>
    <Animated.View style={{ flex: 1, transform: [...translate.getTranslateTransform(), { scale }] }}><Svg width="100%" height="100%" viewBox={drawing.viewBox}>{drawing.paths.map(path => <Path key={path.id} d={path.d} fill="#428177" fillOpacity={0.6} fillRule="evenodd" stroke="#0D1117" strokeWidth={0.00025} accessibilityLabel={path.name} onPress={() => onSelect(path.id)} />)}</Svg></Animated.View>
  </View><View style={{ flexDirection: 'row', gap: 8 }}><View style={{ flex: 1 }}><NativeAction title="تكبير" systemImage="plus.magnifyingglass" onPress={() => zoom(1.4)} /></View><View style={{ flex: 1 }}><NativeAction title="تصغير" systemImage="minus.magnifyingglass" onPress={() => zoom(1 / 1.4)} /></View><View style={{ flex: 1 }}><NativeAction title="ملاءمة الخريطة" systemImage="arrow.up.left.and.arrow.down.right" onPress={reset} /></View></View><Label secondary>المس المحافظة لعرض اسمها وتحديدها.</Label></View>;
}
// PORT STATUS: source resources/js/Pages/SyId/SyriaMap.tsx; confidence medium; todos 1 native map gesture and hole rendering verification.
