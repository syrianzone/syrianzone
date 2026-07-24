import { useInfiniteQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { forwardRef, useImperativeHandle } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { QueryState } from '@/components/ui/QueryState';
import { useAppTheme } from '@/contexts/ThemeContext';

import { discovery } from '../_lib/discovery';
import type { GridPhoto, Paginated } from '../_lib/types';

export interface PhotoGridHandle {
  loadNextPage: () => void;
}

interface PhotoGridProps {
  active: boolean;
  guideId?: number | null;
  onPhotoClick: (photo: GridPhoto) => void;
}

export const PhotoGrid = forwardRef<PhotoGridHandle, PhotoGridProps>(function PhotoGrid(
  { active, guideId = null, onPhotoClick },
  ref,
) {
  const { theme } = useAppTheme();
  const query = useInfiniteQuery<Paginated<GridPhoto>>({
    enabled: active,
    getNextPageParam: (page) => page.current_page < page.last_page ? page.current_page + 1 : undefined,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => discovery.gridPhotos(Number(pageParam), guideId ?? undefined),
    queryKey: ['places', 'gallery', guideId ?? 'all'],
    retry: false,
  });
  const photos = query.data?.pages.flatMap((page) => page.data) ?? [];

  useImperativeHandle(ref, () => ({
    loadNextPage: () => {
      if (active && query.hasNextPage && !query.isFetchingNextPage) {
        void query.fetchNextPage();
      }
    },
  }), [active, query]);

  if (!active) {
    return null;
  }

  return (
    <View style={styles.root}>
      {photos.length > 0 ? (
        <View style={styles.grid}>
          {photos.map((photo) => (
            <Pressable
              accessibilityLabel={`فتح ${photo.place.name} على الخريطة`}
              accessibilityRole="button"
              key={photo.id}
              onPress={() => onPhotoClick(photo)}
              style={[styles.card, { borderColor: theme.palette.border }]}
            >
              <Image contentFit="cover" source={photo.thumb_url} style={styles.image} />
              <AppText numberOfLines={1} style={styles.label} variant="caption">{photo.place.name}</AppText>
            </Pressable>
          ))}
        </View>
      ) : null}
      {query.isError ? (
        <QueryState detail="تعذر تحميل الصور." onRetry={() => void query.refetch()} type="error" />
      ) : query.isLoading ? (
        <AppText color="muted">جارٍ تحميل الصور...</AppText>
      ) : photos.length === 0 ? (
        <QueryState detail="لا توجد صور بعد." type="empty" />
      ) : null}
      {query.isFetchingNextPage ? <AppText color="muted">جارٍ تحميل المزيد...</AppText> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1, overflow: 'hidden', width: '48%' },
  grid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  image: { aspectRatio: 1.15, width: '100%' },
  label: { paddingHorizontal: 9, paddingVertical: 7 },
  root: { gap: 12 },
});

/*
PORT STATUS
  source:     resources/js/Pages/Places/_components/PhotoGrid.tsx (142 lines)
  confidence: high
  todos:      0
  notes:      Native lazy activation, guide-aware automatic paging, place selection, loading, empty, error, and retry preserve the gallery.
*/
