import type { ComponentProps, PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { useLocale } from '@/contexts/LocaleContext';
import { useAppTheme } from '@/contexts/ThemeContext';

import { AppText } from './AppText';

type ButtonVariant = 'danger' | 'ghost' | 'primary' | 'secondary';

interface AppButtonProps
  extends Omit<ComponentProps<typeof Pressable>, 'children' | 'style'> {
  icon?: ReactNode;
  loading?: boolean;
  variant?: ButtonVariant;
}

export function AppButton({
  children,
  disabled,
  icon,
  loading = false,
  variant = 'primary',
  ...props
}: PropsWithChildren<AppButtonProps>) {
  const { direction } = useLocale();
  const { theme } = useAppTheme();
  const background =
    variant === 'primary'
      ? theme.palette.primary
      : variant === 'danger'
        ? theme.palette.danger
        : variant === 'secondary'
          ? theme.palette.surfaceRaised
          : 'transparent';
  const foreground =
    variant === 'primary' || variant === 'danger'
      ? theme.palette.primaryForeground
      : theme.palette.foreground;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      {...props}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: background,
          borderColor: theme.palette.border,
          flexDirection: direction === 'rtl' ? 'row-reverse' : 'row',
          opacity: disabled || loading ? 0.5 : pressed ? 0.75 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} size="small" />
      ) : (
        <View style={styles.icon}>{icon}</View>
      )}
      <AppText
        style={{ color: foreground, textAlign: 'center' }}
        variant="label"
      >
        {children}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
