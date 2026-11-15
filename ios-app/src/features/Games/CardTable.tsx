import { useRef, type ComponentRef } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Label } from '../../components';
import { useTheme } from '../../ui/theme';
import { PlayingCard, type DropPoint } from './PlayingCard';
import type { Card, Play } from './engines';
export function CardTable({ hand, counts, names, plays, legal, selected, large, onCard, children }: {
  hand: Card[]; counts: number[]; names: string[]; plays: Play[]; legal: ReadonlySet<string>; selected: string | null; large: boolean;
  onCard(card: Card, dragged: boolean): void; children?: React.ReactNode;
}): React.JSX.Element {
  const { colors } = useTheme();
  const table = useRef<ComponentRef<typeof View>>(null);
  const cardWidth = Math.min(66, (useWindowDimensions().width - 36) / 5);
  const availableWidth = Math.min(useWindowDimensions().width - 36, 660);
  const step = Math.min(cardWidth + 4, (availableWidth - cardWidth) / Math.max(1, hand.length - 1));
  const drop = (card: Card, point: DropPoint): void => table.current?.measureInWindow((x, y, width, height) => { if (point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height) onCard(card, true); });
  return <View style={{ gap: 14 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>{[1, 2, 3].map(seat => <View key={seat} style={{ alignItems: 'center', gap: 4 }}><Label secondary>{names[seat]}</Label><PlayingCard card={{ id: `back${seat}`, rank: 1, suit: 'S', faceUp: false }} width={36} /><Label secondary>{counts[seat] ?? 0} ورقة</Label></View>)}</View>
    <View ref={table} collapsable={false} accessibilityLabel="طاولة اللعب" style={{ minHeight: 190, backgroundColor: colors.accentMuted, borderRadius: 30, padding: 18, gap: 10 }}>
      {children}<View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 10 }}>{plays.map(play => <View key={`${play.seat}:${play.card.id}`} style={{ alignItems: 'center' }}><Label secondary>{names[play.seat]}</Label><PlayingCard card={play.card} width={cardWidth} large={large} /></View>)}</View>
    </View>
    <Label>أوراقك، المس الورقة لتحديدها ثم المسها ثانية للعب، أو اسحبها إلى الطاولة.</Label>
    <View style={{ width: availableWidth, height: cardWidth * 1.46 + 18, alignSelf: 'center' }}>{hand.map((card, index) => <View key={card.id} style={{ position: 'absolute', start: index * step, top: selected === card.id ? 0 : 12, zIndex: index }}><PlayingCard card={card} width={cardWidth} large={large} selected={selected === card.id} disabled={!legal.has(card.id)} onPress={() => onCard(card, false)} {...(legal.has(card.id) ? { onDrop: (point: DropPoint) => drop(card, point) } : {})} /></View>)}</View>
  </View>;
}
// PORT STATUS: source resources/js/Pages/Games/_components/table.css and Tarneeb.tsx; confidence medium; todos 1 native four-seat drag/layout verification.
