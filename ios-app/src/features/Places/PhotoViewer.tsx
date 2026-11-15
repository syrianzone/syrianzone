import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Modal, ScrollView, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Label } from '../../components';
import { NativeAction } from '../../ui/native';
import { useTheme } from '../../ui/theme';

export interface ViewerPhoto { id: number; url: string; name: string; placeId?: number }
// PORT NOTE: UIScrollView owns pinch zoom and image paging. No browser gesture coordinates are converted into native map positions.
export function PhotoViewer({ photos, initialIndex, close, showPlace }: { photos: readonly ViewerPhoto[]; initialIndex: number | null; close(): void; showPlace?(id: number): void }): React.JSX.Element {
  const { width, height } = useWindowDimensions(), { colors } = useTheme();
  const [index, setIndex] = useState(0);
  const paging = useRef<ComponentRef<typeof ScrollView>>(null);
  const selected = photos[index];
  useEffect(() => {
    if (initialIndex === null) return;
    const next = Math.max(0, Math.min(initialIndex, photos.length - 1));
    setIndex(next); paging.current?.scrollTo({ x: next * width, animated: false });
  }, [initialIndex, width, photos.length]);
  const move = (next: number): void => { if (!photos.length) return; const target = (next + photos.length) % photos.length; setIndex(target); paging.current?.scrollTo({ x: target * width, animated: true }); };
  return <Modal visible={initialIndex !== null} presentationStyle="fullScreen" onRequestClose={close}><SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <View style={{ padding: 14, gap: 6 }}><NativeAction title="إغلاق الصور" onPress={close} /><Label>{selected?.name ?? ''}</Label><Label secondary>{photos.length ? index + 1 : 0} / {photos.length}</Label></View>
    <ScrollView ref={paging} horizontal pagingEnabled style={{ flex: 1, direction: 'ltr' }} showsHorizontalScrollIndicator={false} onContentSizeChange={() => { if (initialIndex !== null) paging.current?.scrollTo({ x: index * width, animated: false }); }} onMomentumScrollEnd={event => setIndex(Math.max(0, Math.min(photos.length - 1, Math.round(event.nativeEvent.contentOffset.x / width))))}>
      {photos.map(photo => <ScrollView key={photo.id} maximumZoomScale={4} minimumZoomScale={1} centerContent pinchGestureEnabled bouncesZoom style={{ width, height: Math.max(220, height - 240) }} contentContainerStyle={{ width, height: Math.max(220, height - 240) }}><Image source={{ uri: photo.url }} accessibilityLabel={photo.name} style={{ width, height: Math.max(220, height - 240) }} contentFit="contain" cachePolicy="memory-disk" /></ScrollView>)}
    </ScrollView>
    <View style={{ padding: 14, gap: 8 }}><View style={{ flexDirection: 'row', gap: 8 }}><View style={{ flex: 1 }}><NativeAction title="الصورة السابقة" disabled={photos.length < 2} onPress={() => move(index - 1)} /></View><View style={{ flex: 1 }}><NativeAction title="الصورة التالية" disabled={photos.length < 2} onPress={() => move(index + 1)} /></View></View>{selected?.placeId !== undefined && showPlace ? <NativeAction title="عرض المكان على الخريطة" onPress={() => { showPlace(selected.placeId!); close(); }} /> : null}</View>
  </SafeAreaView></Modal>;
}
// PORT STATUS: source resources/js/Pages/Places/_components/Lightbox.tsx and PhotoGallery.tsx; confidence medium; todos 1 native pinch, paging, resize and accessibility verification.
