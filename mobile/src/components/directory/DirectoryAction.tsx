import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';
import { isSafeExternalUrl, openSafeExternalUrl } from '@/lib/linking';

interface DirectoryActionProps {
  disabled?: boolean;
  icon?: ReactNode;
  label: string;
  onPress: () => void;
}

export function DirectoryAction({
  disabled = false,
  icon,
  label,
  onPress,
}: DirectoryActionProps) {
  const { theme } = useAppTheme();

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: theme.palette.surfaceRaised,
          borderColor: theme.palette.border,
          opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
        },
      ]}
    >
      {icon}
      <AppText variant="caption">{label}</AppText>
    </Pressable>
  );
}

interface DirectoryLinkActionProps {
  disabledWhenMissing?: boolean;
  icon?: ReactNode;
  label: string;
  url: null | string | undefined;
}

export function DirectoryLinkAction({
  disabledWhenMissing = false,
  icon,
  label,
  url,
}: DirectoryLinkActionProps) {
  const safe = Boolean(url && isSafeExternalUrl(url));
  if (!safe && !disabledWhenMissing) {
    return null;
  }

  return (
    <DirectoryAction
      disabled={!safe}
      icon={icon}
      label={label}
      onPress={() => {
        if (url) {
          void openSafeExternalUrl(url).catch(() => false);
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 5,
    minHeight: 36,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
});
