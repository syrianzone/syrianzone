import { useMemo, useRef } from 'react';
import { Animated, PanResponder, Pressable, Text, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { cards, type Card } from './engines';
const { RANK_LABEL, SUIT_LABEL, isRed } = cards;
import { useTheme } from '../../ui/theme';
import { cardPips } from './model';
const SUIT_AR = { S: 'بستوني', H: 'كبة', D: 'ديناري', C: 'سباتي' };
export interface DropPoint { x: number; y: number }
// PORT NOTE: Cards are native text/shapes. Only the drag translation is animated, so card identity and rank never change during a gesture.
export function PlayingCard({ card, width = 62, large = false, selected = false, hinted = false, hidden = false, disabled = false, decorative = false, onPress, onDrop }: {
  card: Card; width?: number; large?: boolean; selected?: boolean; hinted?: boolean; hidden?: boolean; disabled?: boolean;
  decorative?: boolean;
  onPress?(): void; onDrop?(point: DropPoint): void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const translation = useRef(new Animated.ValueXY()).current;
  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => Boolean(onDrop) && !disabled && Math.max(Math.abs(gesture.dx), Math.abs(gesture.dy)) > 7,
    onPanResponderMove: Animated.event([null, { dx: translation.x, dy: translation.y }], { useNativeDriver: false }),
    onPanResponderRelease: (_event, gesture) => { onDrop?.({ x: gesture.moveX, y: gesture.moveY }); translation.setValue({ x: 0, y: 0 }); },
    onPanResponderTerminate: () => translation.setValue({ x: 0, y: 0 })
  }), [onDrop, disabled, translation]);
  const height = width * 1.46;
  const faceDown = hidden || !card.faceUp;
  const color = isRed(card) ? '#B91C1C' : '#17211D';
  const rank = RANK_LABEL[card.rank] ?? String(card.rank);
  const suit = SUIT_LABEL[card.suit];
  return <Animated.View {...responder.panHandlers} style={{ width, height, zIndex: selected ? 20 : 0, transform: translation.getTranslateTransform() }}>
    <Pressable disabled={disabled || faceDown || decorative} accessible={!decorative} onPress={event => { event.stopPropagation(); onPress?.(); }} accessibilityRole="button" accessibilityLabel={faceDown ? 'ورقة مقلوبة' : `${rank} ${SUIT_AR[card.suit]}`} accessibilityState={{ selected, disabled }}
      style={{ width, height, borderRadius: 7, backgroundColor: '#FFFFFF', overflow: 'hidden', borderWidth: selected || hinted ? 3 : 1, borderColor: selected || hinted ? colors.accent : '#B9C2BD', opacity: disabled && !faceDown ? 0.65 : 1 }}>
      {faceDown ? <Svg width={width} height={height} viewBox="0 0 62 91"><Rect x={3} y={3} width={56} height={85} rx={4} fill="#147A51" />{Array.from({ length: 12 }, (_, i) => <Line key={i} x1={0} x2={62} y1={i * 12} y2={i * 12 - 62} stroke="#DDEFE5" strokeWidth={0.6} />)}</Svg> : <View accessible={false} style={{ flex: 1 }}>
        <Text style={{ position: 'absolute', start: 3, top: 1, color, fontWeight: '700', fontSize: width * 0.21, lineHeight: width * 0.25 }}>{rank}{suit}</Text>
        {large || card.rank >= 11 ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color, fontWeight: '700', fontSize: width * 0.48 }}>{rank}</Text><Text style={{ color, fontSize: width * 0.32 }}>{suit}</Text></View>
          : cardPips(card.rank).map((pip, i) => <Text key={i} style={{ position: 'absolute', start: `${pip.x}%`, top: `${pip.y}%`, color, fontSize: width * (card.rank === 1 ? 0.58 : 0.28), lineHeight: width * 0.6, width: width * 0.5, height: width * 0.6, textAlign: 'center', transform: [{ translateX: width * -0.25 }, { translateY: width * -0.3 }, { rotate: pip.flip ? '180deg' : '0deg' }] }}>{suit}</Text>)}
      </View>}
    </Pressable>
  </Animated.View>;
}
// PORT STATUS: source resources/js/Domain/games/PlayingCard.tsx and resources/js/Domain/games/cards.ts; confidence medium; todos 1 visible pip/RTL gesture comparison.
