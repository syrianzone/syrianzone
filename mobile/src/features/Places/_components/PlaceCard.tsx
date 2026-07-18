import { Image } from 'expo-image';
import {
  Bookmark,
  Church,
  Ghost,
  Landmark,
  MapPin,
  Mountain,
  Palette,
  Store,
  TreePine,
  Utensils,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';

import { CATEGORY_LABELS } from '../_lib/categories';
import type { PlaceCategory, PlaceListItem } from '../_lib/types';

const CATEGORY_ICONS: Record<PlaceCategory, typeof MapPin> = {
  abandoned: Ghost,
  cultural: Palette,
  food: Utensils,
  historical: Landmark,
  market: Store,
  natural: TreePine,
  other: MapPin,
  religious: Church,
  viewpoint: Mountain,
};

export function PlaceCard({ onPress, place }: { onPress: (id: number) => void; place: PlaceListItem }) {
  const { theme } = useAppTheme();
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const broken = place.thumb_url === brokenUrl;
  const Icon = CATEGORY_ICONS[place.category];

  return (
    <Pressable
      accessibilityLabel={place.name}
      onPress={() => onPress(place.id)}
      style={({ pressed }) => [
        styles.root,
        {
          backgroundColor: theme.palette.surface,
          borderColor: theme.palette.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      {place.thumb_url && !broken ? (
        <Image
          contentFit="cover"
          onError={() => setBrokenUrl(place.thumb_url)}
          source={place.thumb_url}
          style={styles.image}
        />
      ) : (
        <View
          style={[
            styles.image,
            styles.placeholder,
            { backgroundColor: theme.palette.surfaceRaised },
          ]}
        >
          <Icon color={theme.palette.mutedForeground} size={24} />
        </View>
      )}
      <View style={styles.copy}>
        <AppText numberOfLines={1} variant="label">{place.name}</AppText>
        <AppText color="muted" variant="caption">{CATEGORY_LABELS[place.category]}</AppText>
        <View style={styles.counts}>
          <Bookmark color={theme.palette.mutedForeground} size={14} />
          <AppText color="muted" variant="caption">{place.saves_count}</AppText>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  copy: { flex: 1, gap: 4 },
  counts: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  image: { borderRadius: 12, height: 72, width: 72 },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  root: { alignItems: 'center', borderRadius: 16, borderWidth: 1, flexDirection: 'row-reverse', gap: 12, padding: 10 },
});

/*
PORT STATUS
  source:     resources/js/Pages/Places/_components/PlaceCard.tsx (67 lines)
  confidence: high
  todos:      0
  notes:      Native cards retain thumbnails, fallbacks, category, save count, and selection.
*/
