import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/contexts/ThemeContext';

import { AppText } from './AppText';

export function Avatar({
  label,
  size = 36,
  uri,
}: {
  label: string;
  size?: number;
  uri?: string | null;
}) {
  const { theme } = useAppTheme();
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const failed = uri !== null && uri !== undefined && failedUri === uri;

  const frame = {
    borderRadius: size / 2,
    height: size,
    width: size,
  };

  if (uri && !failed) {
    return (
      <Image
        accessibilityLabel={label}
        onError={() => setFailedUri(uri)}
        source={uri}
        style={frame}
        testID="avatar-image"
      />
    );
  }

  return (
    <View
      accessibilityLabel={label}
      style={[
        styles.fallback,
        frame,
        { backgroundColor: theme.palette.surfaceRaised },
      ]}
    >
      <AppText variant="label">{label.trim().slice(0, 1) || '?'}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
