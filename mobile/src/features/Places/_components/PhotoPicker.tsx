import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { ImagePlus, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';

import {
  MAX_PLACE_PHOTOS,
  mergePickedPhotos,
  type PickedPhotoCandidate,
  type PlacePhotoUpload,
} from '../_lib/submission';

function withKnownSize(asset: ImagePicker.ImagePickerAsset): PickedPhotoCandidate {
  if (asset.fileSize) {
    return asset;
  }

  try {
    return { ...asset, fileSize: new File(asset.uri).size };
  } catch {
    return asset;
  }
}

export function PhotoPicker({
  max = MAX_PLACE_PHOTOS,
  onChange,
  photos,
}: {
  max?: number;
  onChange: (photos: PlacePhotoUpload[]) => void;
  photos: readonly PlacePhotoUpload[];
}) {
  const { theme } = useAppTheme();
  const [error, setError] = useState<string | null>(null);

  const pick = async () => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('يلزم السماح بالوصول إلى الصور لاختيار صور المكان.');
      return;
    }

    const remaining = max - photos.length;
    if (remaining <= 0) {
      setError(`الحد الأقصى ${max} صور.`);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ['images'],
      quality: 0.9,
      selectionLimit: remaining,
    });
    if (result.canceled) {
      return;
    }

    const merged = mergePickedPhotos(
      photos,
      result.assets.map(withKnownSize),
      max,
    );
    setError(merged.errors.length > 0 ? merged.errors.join('، ') : null);
    onChange(merged.photos);
  };

  const removeAt = (index: number) => {
    setError(null);
    onChange(photos.filter((_, photoIndex) => photoIndex !== index));
  };

  return (
    <View style={styles.root}>
      {error ? <AppText color="danger">{error}</AppText> : null}
      <View style={styles.previews}>
        {photos.map((photo, index) => (
          <View
            key={photo.uri}
            style={[styles.preview, { borderColor: theme.palette.border }]}
          >
            <Image contentFit="cover" source={photo.uri} style={styles.image} />
            <Pressable
              accessibilityLabel={`إزالة الصورة ${index + 1}`}
              accessibilityRole="button"
              onPress={() => removeAt(index)}
              style={styles.remove}
            >
              <X color="#ffffff" size={16} />
            </Pressable>
            <View style={styles.size}>
              <AppText style={styles.sizeText} variant="caption">
                {(photo.fileSize / 1_048_576).toFixed(1)} MB
              </AppText>
            </View>
          </View>
        ))}
      </View>
      {photos.length < max ? (
        <AppButton
          icon={<ImagePlus color={theme.palette.foreground} size={18} />}
          onPress={() => void pick()}
          variant="secondary"
        >
          إضافة صور
        </AppButton>
      ) : null}
      <AppText color="muted" variant="caption">
        من صورة واحدة إلى {max} صور، JPEG أو PNG أو WebP، بحد أقصى 12 MB لكل صورة.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    height: 104,
    width: '100%',
  },
  preview: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    width: '31%',
  },
  previews: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  remove: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    borderRadius: 16,
    height: 28,
    justifyContent: 'center',
    left: 5,
    position: 'absolute',
    top: 5,
    width: 28,
  },
  root: {
    gap: 10,
  },
  size: {
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
    bottom: 0,
    left: 0,
    paddingVertical: 2,
    position: 'absolute',
    right: 0,
  },
  sizeText: {
    color: '#ffffff',
    textAlign: 'center',
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Places/_components/PhotoPicker.tsx (118 lines)
  confidence: high
  todos:      0
  notes:      Native previews, removal, format, size, dimensions, and the ten-photo limit preserve the source contract.
*/
