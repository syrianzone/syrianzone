import { Image } from 'expo-image';
import { Heart, MapPin, MessageCircle } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';

import { CATEGORY_LABELS } from '../_lib/categories';
import type { PlaceListItem } from '../_lib/types';

export function PlaceCard({ onPress, place }: { onPress: (id: number) => void; place: PlaceListItem }) {
  const { theme } = useAppTheme();
  return (
    <Pressable
      accessibilityLabel={place.name}
      onPress={() => onPress(place.id)}
      style={({ pressed }) => [styles.root, { backgroundColor: theme.palette.surface, borderColor: theme.palette.border, opacity: pressed ? 0.7 : 1 }]}
    >
      {place.thumb_url ? (
        <Image contentFit="cover" source={place.thumb_url} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.placeholder, { backgroundColor: theme.palette.surfaceRaised }]}>
          <MapPin color={theme.palette.mutedForeground} size={24} />
        </View>
      )}
      <View style={styles.copy}>
        <AppText numberOfLines={1} variant="label">{place.name}</AppText>
        <AppText color="muted" variant="caption">{CATEGORY_LABELS[place.category]}</AppText>
        <View style={styles.counts}>
          <Heart color={theme.palette.mutedForeground} size={14} />
          <AppText color="muted" variant="caption">{place.likes_count}</AppText>
          <MessageCircle color={theme.palette.mutedForeground} size={14} />
          <AppText color="muted" variant="caption">{place.comments_count}</AppText>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({ copy: { flex: 1, gap: 4 }, counts: { alignItems: 'center', flexDirection: 'row', gap: 5 }, image: { borderRadius: 12, height: 72, width: 72 }, placeholder: { alignItems: 'center', justifyContent: 'center' }, root: { alignItems: 'center', borderRadius: 16, borderWidth: 1, flexDirection: 'row-reverse', gap: 12, padding: 10 } });

/*
PORT STATUS
  source:     resources/js/Pages/Places/_components/PlaceCard.tsx (70 lines)
  confidence: high
  todos:      0
  notes:      Native cards retain thumbnails, category, engagement counts, and selection.
*/
