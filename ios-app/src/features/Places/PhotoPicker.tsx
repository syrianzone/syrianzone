import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { Label, Photo } from '../../components';
import { NativeAction } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { acceptPhotos, type PickedPhoto } from './model';

async function pickNativePhotoBatch(available: number): Promise<ReturnType<typeof acceptPhotos>> {
  if (available < 1) return { accepted: [], errors: [] };
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: available, orderedSelection: true, quality: 1,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible });
  if (result.canceled) return { accepted: [], errors: [] };
  return acceptPhotos(result.assets.map((asset, index) => {
    let size = asset.fileSize ?? NaN;
    if (!Number.isFinite(size)) try { size = new File(asset.uri).size; } catch { size = NaN; }
    return { uri: asset.uri, name: asset.fileName ?? `photo-${index + 1}.jpg`, mimeType: asset.mimeType ?? 'image/jpeg', size, width: asset.width, height: asset.height };
  }), available);
}
export async function pickNativePhotos(available: number): Promise<PickedPhoto[]> {
  const result = await pickNativePhotoBatch(available);
  if (!result.accepted.length && result.errors.length) throw new Error(result.errors.join('\n'));
  return result.accepted;
}
export function ContributionPhotos({ photos, change, disabled = false }: { photos: PickedPhoto[]; change(photos: PickedPhoto[]): void; disabled?: boolean }): React.JSX.Element {
  const { colors } = useTheme();
  const [error, setError] = useState<string | null>(null), [picking, setPicking] = useState(false);
  const alive = useRef(true), pickingNow = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const pick = async (): Promise<void> => { if (pickingNow.current || disabled) return; pickingNow.current = true; setPicking(true); setError(null); try { const batch = await pickNativePhotoBatch(10 - photos.length); if (alive.current) { change([...photos, ...batch.accepted]); setError(batch.errors.length ? batch.errors.join('\n') : null); } } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : 'تعذر اختيار الصور.'); } finally { pickingNow.current = false; if (alive.current) setPicking(false); } };
  return <View style={{ gap: 10 }}><Label>الصور ({photos.length} / 10)</Label><ScrollView horizontal contentContainerStyle={{ gap: 12 }}>{photos.map((photo, index) => <View key={`${photo.uri}:${index}`} style={{ width: 170, gap: 6 }}><Photo url={photo.uri} label={photo.name} height={120} /><Label secondary>{(photo.size / 1048576).toFixed(1)} MB</Label><NativeAction title="إزالة الصورة" disabled={disabled || picking} onPress={() => change(photos.filter((_item, position) => position !== index))} /></View>)}</ScrollView>{photos.length < 10 ? <NativeAction title={picking ? 'جارٍ اختيار الصور' : 'اختيار صور'} disabled={disabled || picking} systemImage="photo.on.rectangle" onPress={() => { void pick(); }} /> : null}<Label secondary>JPG أو PNG أو WebP، حتى 12 ميغابايت للصورة، وأبعاد بين 200 و6000 بكسل.</Label>{error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}</View>;
}
// PORT STATUS: source resources/js/Pages/Places/_components/PhotoPicker.tsx; confidence medium; todos 1 native HEIC-compatible representation, cancellation and media-limit verification.
