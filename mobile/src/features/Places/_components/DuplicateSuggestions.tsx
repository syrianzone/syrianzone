import { Image } from 'expo-image';
import { MapPin } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';

import type { NearbyPlace } from '../_lib/types';

export function DuplicateSuggestions({
  onContinue,
  onSelectExisting,
  places,
}: {
  onContinue: () => void;
  onSelectExisting: (id: number) => void;
  places: readonly NearbyPlace[];
}) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.root}>
      <AppText variant="label">توجد أماكن قريبة من النقطة المحددة</AppText>
      {places.map((place) => (
        <View
          key={place.id}
          style={[styles.place, { borderColor: theme.palette.border }]}
        >
          {place.thumb_url ? (
            <Image
              contentFit="cover"
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
              <MapPin color={theme.palette.mutedForeground} size={22} />
            </View>
          )}
          <View style={styles.copy}>
            <AppText numberOfLines={1} variant="label">
              {place.name}
            </AppText>
            <AppText color="muted" variant="caption">
              {Math.round(place.distance_m).toLocaleString('ar-SY')} متر
            </AppText>
          </View>
          <AppButton
            onPress={() => onSelectExisting(place.id)}
            variant="secondary"
          >
            هذا هو المكان
          </AppButton>
        </View>
      ))}
      <AppButton onPress={onContinue}>مكاني مختلف، متابعة</AppButton>
    </View>
  );
}

const styles = StyleSheet.create({
  copy: {
    flex: 1,
    gap: 3,
  },
  image: {
    borderRadius: 10,
    height: 56,
    width: 56,
  },
  place: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 8,
    padding: 8,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  root: {
    gap: 10,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Places/_components/DuplicateSuggestions.tsx (42 lines)
  confidence: high
  todos:      0
  notes:      Nearby thumbnails, distances, existing-place selection, and explicit continuation preserve duplicate review.
*/
