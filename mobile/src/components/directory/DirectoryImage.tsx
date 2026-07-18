import { Image } from 'expo-image';
import { ImageOff, RotateCcw } from 'lucide-react-native';
import { useState } from 'react';
import {
  StyleSheet,
  Pressable,
  View,
  type ImageStyle,
  type StyleProp,
} from 'react-native';

import { useAppTheme } from '@/contexts/ThemeContext';
import { AppText } from '@/components/ui/AppText';

interface DirectoryImageProps {
  accessibilityLabel: string;
  fallbackUri?: null | string;
  retryLabel?: string;
  style?: StyleProp<ImageStyle>;
  unavailableLabel?: string;
  uri: null | string | undefined;
}

export function DirectoryImage({
  accessibilityLabel,
  fallbackUri,
  retryLabel = 'إعادة المحاولة',
  style,
  unavailableLabel = 'صورة غير متاحة',
  uri,
}: DirectoryImageProps) {
  const { theme } = useAppTheme();
  const [failedUris, setFailedUris] = useState<Record<string, true>>({});
  const candidates = [uri, fallbackUri].filter(
    (candidate): candidate is string => Boolean(candidate),
  );
  const activeUri = candidates.find((candidate) => !failedUris[candidate]);

  if (!activeUri) {
    const content = (
      <>
        <ImageOff color={theme.palette.mutedForeground} size={30} />
        {candidates.length > 0 ? (
          <View style={styles.retryLabel}>
            <RotateCcw color={theme.palette.mutedForeground} size={14} />
            <AppText color="muted" variant="caption">
              {retryLabel}
            </AppText>
          </View>
        ) : null}
      </>
    );
    const placeholderStyle = [
      styles.placeholder,
      { backgroundColor: theme.palette.surfaceRaised },
      style,
    ];

    if (candidates.length > 0) {
      return (
        <Pressable
          accessibilityLabel={`${accessibilityLabel}: ${unavailableLabel}`}
          accessibilityRole="button"
          onPress={() => setFailedUris({})}
          style={placeholderStyle}
        >
          {content}
        </Pressable>
      );
    }

    return (
      <View
        accessibilityLabel={`${accessibilityLabel}: ${unavailableLabel}`}
        style={placeholderStyle}
      >
        {content}
      </View>
    );
  }

  return (
    <Image
      accessibilityLabel={accessibilityLabel}
      cachePolicy="memory-disk"
      contentFit="cover"
      onError={() =>
        setFailedUris((current) => ({ ...current, [activeUri]: true }))
      }
      source={{ uri: activeUri }}
      style={[styles.image, style]}
      transition={150}
    />
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: '#e5e7eb',
    borderRadius: 14,
    height: 170,
    width: '100%',
  },
  placeholder: {
    alignItems: 'center',
    borderRadius: 14,
    height: 170,
    justifyContent: 'center',
    width: '100%',
  },
  retryLabel: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 5,
  },
});
