import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Text, View, type GestureResponderHandlers } from 'react-native';
import type { AbsorbedTile, Tile } from '../engines';
import { useTheme } from '../../../ui/theme';
import { boardGeometry, describeTileMotion, MOTION_2048 } from './motion';

const TILE_COLORS: Record<number, [string, string]> = { 2: ['#EEE4DA', '#554A40'], 4: ['#EDE0C8', '#554A40'], 8: ['#F2B179', '#302117'], 16: ['#F59563', '#302117'], 32: ['#F67C5F', '#302117'], 64: ['#F65E3B', '#201A16'], 128: ['#EDCF72', '#302117'], 256: ['#EDCC61', '#302117'], 512: ['#EDC850', '#302117'], 1024: ['#EDC53F', '#302117'], 2048: ['#EDC22E', '#302117'] };
const ease = Easing.bezier(0.2, 0, 0.2, 1);

export function use2048ReducedMotion(): boolean | null {
  // Mount fresh faces after the OS preference, preserving normal spawn motion without guessing.
  const [reduced, setReduced] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true, changes = 0;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { changes++; if (active) setReduced(value); });
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active && changes === 0) setReduced(value); }).catch(() => { if (active && changes === 0) setReduced(true); });
    return () => { active = false; subscription.remove(); };
  }, []);
  return reduced;
}

export function Game2048Board({ board, ghosts, size, reducedMotion, panHandlers }: {
  board: readonly Tile[]; ghosts: readonly AbsorbedTile[]; size: number; reducedMotion: boolean; panHandlers: GestureResponderHandlers;
}): React.JSX.Element {
  const { colors } = useTheme(), geometry = boardGeometry(size);
  // PORT NOTE: the source board explicitly uses LTR coordinates inside an RTL page.
  return <View {...panHandlers} accessible={false} accessibilityLabel="لوحة 2048" style={{ direction: 'ltr', width: size, height: size, backgroundColor: colors.separator, borderRadius: 18, alignSelf: 'center', overflow: 'visible' }}>
    {Array.from({ length: 16 }, (_, index) => <View key={`cell-${index}`} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', left: geometry.padding + index % 4 * geometry.pitch, top: geometry.padding + Math.floor(index / 4) * geometry.pitch, width: geometry.cell, height: geometry.cell, borderRadius: 12, backgroundColor: colors.surface }} />)}
    {!reducedMotion ? ghosts.map(ghost => <GhostTile key={ghost.id} ghost={ghost} cell={geometry.cell} pitch={geometry.pitch} padding={geometry.padding} />) : null}
    {board.map(tile => <LiveTile key={tile.id} tile={tile} cell={geometry.cell} pitch={geometry.pitch} padding={geometry.padding} reducedMotion={reducedMotion} />)}
  </View>;
}

function usePosition(col: number, row: number, pitch: number, reducedMotion: boolean): ({ translateX: Animated.AnimatedMultiplication } | { translateY: Animated.AnimatedMultiplication })[] {
  const [position] = useState(() => new Animated.ValueXY({ x: col, y: row }));
  const previous = useRef({ col, row });
  useLayoutEffect(() => {
    const moved = previous.current.col !== col || previous.current.row !== row;
    previous.current = { col, row };
    position.stopAnimation();
    if (reducedMotion || !moved) { position.setValue({ x: col, y: row }); return; }
    const animation = Animated.timing(position, { toValue: { x: col, y: row }, duration: MOTION_2048.slide, easing: ease, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [col, row, reducedMotion, position]);
  // Cell units keep an in-progress slide aligned when the board resizes.
  return useMemo(() => [{ translateX: Animated.multiply(position.x, pitch) }, { translateY: Animated.multiply(position.y, pitch) }], [position, pitch]);
}

function LiveTile({ tile, cell, pitch, padding, reducedMotion }: { tile: Tile; cell: number; pitch: number; padding: number; reducedMotion: boolean }): React.JSX.Element {
  const { colors } = useTheme(), palette = TILE_COLORS[tile.value] ?? [colors.surface, colors.text];
  const translation = usePosition(tile.col, tile.row, pitch, reducedMotion);
  const [scale] = useState(() => new Animated.Value(1)), [opacity] = useState(() => new Animated.Value(1));
  const handled = useRef('');
  const motion = describeTileMotion(tile, reducedMotion);
  useLayoutEffect(() => {
    scale.stopAnimation(); opacity.stopAnimation(); scale.setValue(1); opacity.setValue(1);
    if (handled.current === motion.key) return;
    handled.current = motion.key;
    if (motion.kind === 'none') return;
    let animation: Animated.CompositeAnimation;
    if (motion.kind === 'spawn') {
      scale.setValue(0.2); opacity.setValue(0);
      animation = Animated.parallel([Animated.timing(scale, { toValue: 1, duration: motion.duration, easing: ease, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: motion.duration, easing: ease, useNativeDriver: true })]);
    } else {
      animation = Animated.sequence([...(motion.delay ? [Animated.delay(motion.delay)] : []),
        Animated.timing(scale, { toValue: MOTION_2048.popPeak, duration: motion.duration * 0.4, easing: ease, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: motion.duration * 0.6, easing: ease, useNativeDriver: true })]);
    }
    animation.start();
    return () => animation.stop();
  }, [motion.key, motion.kind, motion.delay, motion.duration, scale, opacity]);
  return <Animated.View testID={`2048.tile.${tile.id}`} pointerEvents="none" accessible={false}
    style={[{ position: 'absolute', left: padding, top: padding, width: cell, height: cell }, { transform: translation }]}>
    <Animated.View style={{ width: cell, height: cell, borderRadius: 12, backgroundColor: palette[0], alignItems: 'center', justifyContent: 'center', opacity, transform: [{ scale }] }}>
      <Text accessible accessibilityLabel={String(tile.value)} style={{ color: palette[1], fontSize: tile.value >= 1024 ? cell * 0.26 : cell * 0.38, fontWeight: '800' }}>{tile.value}</Text>
    </Animated.View>
  </Animated.View>;
}

function GhostTile({ ghost, cell, pitch, padding }: { ghost: AbsorbedTile; cell: number; pitch: number; padding: number }): React.JSX.Element {
  const { colors } = useTheme(), palette = TILE_COLORS[ghost.value] ?? [colors.surface, colors.text];
  const [position] = useState(() => new Animated.ValueXY({ x: ghost.col, y: ghost.row }));
  const [scale] = useState(() => new Animated.Value(1)), [opacity] = useState(() => new Animated.Value(1));
  const translation = useMemo<ReturnType<typeof usePosition>>(() => [{ translateX: Animated.multiply(position.x, pitch) }, { translateY: Animated.multiply(position.y, pitch) }], [position, pitch]);
  useLayoutEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(position, { toValue: { x: ghost.targetCol, y: ghost.targetRow }, duration: MOTION_2048.slide, easing: ease, useNativeDriver: true }),
      Animated.sequence([Animated.delay(MOTION_2048.slide), Animated.parallel([
        Animated.timing(scale, { toValue: MOTION_2048.ghostScale, duration: MOTION_2048.fade, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: MOTION_2048.fade, easing: Easing.in(Easing.ease), useNativeDriver: true })])])]);
    animation.start();
    return () => animation.stop();
  }, [ghost.targetCol, ghost.targetRow, position, scale, opacity]);
  return <Animated.View testID={`2048.ghost.${ghost.id}`} pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={{ position: 'absolute', left: padding, top: padding, width: cell, height: cell, transform: translation }}>
    <Animated.View style={{ width: cell, height: cell, borderRadius: 12, backgroundColor: palette[0], alignItems: 'center', justifyContent: 'center', opacity, transform: [{ scale }] }}>
      <Text accessible={false} style={{ color: palette[1], fontSize: ghost.value >= 1024 ? cell * 0.26 : cell * 0.38, fontWeight: '800' }}>{ghost.value}</Text>
    </Animated.View>
  </Animated.View>;
}

// PORT STATUS: source resources/js/Pages/Games/_components/Game2048.tsx and 2048/styles.css; confidence high; todos 1 observed native motion and reduced-motion verification.
