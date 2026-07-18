import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, type TextProps } from 'react-native';

import { useLocale } from '@/contexts/LocaleContext';
import { useAppTheme } from '@/contexts/ThemeContext';

type TextVariant = 'body' | 'caption' | 'heading' | 'label' | 'title';

interface AppTextProps extends TextProps {
  color?: 'default' | 'danger' | 'muted' | 'primary' | 'success';
  variant?: TextVariant;
}

export function AppText({
  children,
  color = 'default',
  style,
  variant = 'body',
  ...props
}: PropsWithChildren<AppTextProps>) {
  const { textAlign } = useLocale();
  const { theme } = useAppTheme();
  const colors = {
    default: theme.palette.foreground,
    danger: theme.palette.danger,
    muted: theme.palette.mutedForeground,
    primary: theme.palette.primary,
    success: theme.palette.success,
  } as const;

  return (
    <Text
      {...props}
      style={[
        styles.base,
        styles[variant],
        { color: colors[color], textAlign },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily: 'IBMPlexSansArabic_400Regular',
    writingDirection: 'auto',
  },
  body: {
    fontSize: 16,
    lineHeight: 26,
  },
  caption: {
    fontSize: 13,
    lineHeight: 20,
  },
  heading: {
    fontFamily: 'IBMPlexSansArabic_600SemiBold',
    fontSize: 20,
    lineHeight: 30,
  },
  label: {
    fontFamily: 'IBMPlexSansArabic_600SemiBold',
    fontSize: 15,
    lineHeight: 22,
  },
  title: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 28,
    lineHeight: 40,
  },
});
