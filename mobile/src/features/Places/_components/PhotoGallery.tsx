import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import type { PlacePhoto } from '../_lib/types';

export function PhotoGallery({ name, photos }: { name: string; photos: readonly PlacePhoto[] }) {
  const [active, setActive] = useState(0);
  const selectedIndex = Math.min(active, Math.max(photos.length - 1, 0));
  const photo = photos[selectedIndex];
  if (!photo) {
    return null;
  }
  return (
    <>
      <Image accessibilityLabel={name} contentFit="cover" source={photo.display_url} style={styles.hero} />
      {photos.length > 1 ? (
        <ScrollView contentContainerStyle={styles.thumbnails} horizontal showsHorizontalScrollIndicator={false}>
          {photos.map((item, index) => (
            <Pressable key={item.id} onPress={() => setActive(index)}>
              <Image accessibilityLabel={`${name} ${index + 1}`} contentFit="cover" source={item.thumb_url} style={[styles.thumbnail, index === selectedIndex ? styles.active : null]} />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({ active: { borderColor: '#428177', borderWidth: 3 }, hero: { borderRadius: 16, height: 250, width: '100%' }, thumbnail: { borderRadius: 9, height: 62, width: 62 }, thumbnails: { gap: 8 } });

/*
PORT STATUS
  source:     resources/js/Pages/Places/_components/PhotoGallery.tsx (64 lines)
  confidence: high
  todos:      0
  notes:      Native image gallery keeps full images, thumbnails, labels, and active selection.
*/
