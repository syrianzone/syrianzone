import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';
import { resolvePollImageUrl } from '@/features/Polls/sharing';

interface TierAvatarProps {
  imageUrl: null | string;
  name: string;
  size?: number;
}

export function TierAvatar({ imageUrl, name, size = 36 }: TierAvatarProps) {
  const { theme } = useAppTheme();
  const source = resolvePollImageUrl(imageUrl);
  if (!source) {
    return (
      <View
        accessibilityLabel={name}
        style={[
          styles.fallback,
          {
            backgroundColor: theme.palette.surfaceRaised,
            borderColor: theme.palette.border,
            borderRadius: size / 2,
            height: size,
            width: size,
          },
        ]}
      >
        <AppText style={styles.initial} variant="caption">
          {name.trim().charAt(0) || '؟'}
        </AppText>
      </View>
    );
  }
  return (
    <Image
      accessibilityLabel={name}
      contentFit="cover"
      source={{ uri: source }}
      style={{ borderRadius: size / 2, height: size, width: size }}
      transition={150}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
  },
  initial: {
    textAlign: 'center',
  },
});

/*
PORT STATUS
  source:     resources/js/Components/poll/TierAvatar.tsx (22 lines)
  confidence: high
  todos:      0
  notes:      Expo Image and an initial fallback replace the browser image element.
*/
