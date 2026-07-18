import { forwardRef } from 'react';
import {
  StyleSheet,
  TextInput,
  type TextInputProps,
} from 'react-native';

import { useLocale } from '@/contexts/LocaleContext';
import { useAppTheme } from '@/contexts/ThemeContext';

export const AppInput = forwardRef<TextInput, TextInputProps>(
  function AppInput({ style, ...props }, ref) {
    const { textAlign } = useLocale();
    const { theme } = useAppTheme();

    return (
      <TextInput
        ref={ref}
        placeholderTextColor={theme.palette.mutedForeground}
        {...props}
        style={[
          styles.input,
          {
            backgroundColor: theme.palette.surface,
            borderColor: theme.palette.border,
            color: theme.palette.foreground,
            textAlign,
          },
          style,
        ]}
      />
    );
  },
);

const styles = StyleSheet.create({
  input: {
    borderRadius: 14,
    borderWidth: 1,
    fontFamily: 'IBMPlexSansArabic_400Regular',
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});
