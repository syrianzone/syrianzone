import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Label } from '../../../components';
import { cards, type Suit } from '../engines';
import { PlayingCard } from '../PlayingCard';
import { sheddingColumns } from './layout';

// PORT NOTE: Native columns reserve every rank slot, matching the original board without reflow when another card is played.
export function SheddingLayout({ laid, large }: { laid: Partial<Record<Suit, number[]>>; large: boolean }): React.JSX.Element {
  const [width, setWidth] = useState(0);
  const columns = useMemo(() => sheddingColumns(laid), [laid]);
  const cardWidth = Math.max(20, Math.min(51.2, (width - 24) / 4));
  const step = 11.2, height = cardWidth * 1.46 + 12 * step;
  return <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ width: '100%', direction: 'ltr', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
    {columns.map(column => <View key={column.suit} style={{ width: cardWidth, height }}>
      {column.cards.length === 0 ? <View style={{ flex: 1, justifyContent: 'center' }}><Label secondary style={{ textAlign: 'center' }}>{cards.SUIT_LABEL[column.suit]}</Label></View> : null}
      {column.cards.map(slot => <View key={slot.card.id} style={{ position: 'absolute', left: 0, top: slot.index * step }}><PlayingCard card={slot.card} width={cardWidth} large={large} decorative /></View>)}
    </View>)}
  </View>;
}
// PORT STATUS: source resources/js/Pages/Games/_components/Trix.tsx Layout and resources/js/Pages/Games/Trix/styles.css; confidence medium; todos 1 native layout verification.
