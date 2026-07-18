import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';

import { normalizeCompassColor } from './model';

const presets = [
  '#4caf50',
  '#2196f3',
  '#ff9800',
  '#9c27b0',
  '#f44336',
  '#00bcd4',
  '#1f2937',
  '#f4b942',
] as const;

interface ColorEditorProps {
  color: string;
  label: string;
  onChange: (color: string) => void;
}

export function ColorEditor({ color, label, onChange }: ColorEditorProps) {
  const { theme } = useAppTheme();
  const [draft, setDraft] = useState(color);
  const [invalid, setInvalid] = useState(false);

  const commit = () => {
    const normalized = normalizeCompassColor(draft);
    if (!normalized) {
      setDraft(color);
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setDraft(normalized);
    onChange(normalized);
  };

  return (
    <View style={styles.root}>
      <AppText variant="label">{label}</AppText>
      <View style={styles.inputRow}>
        <View
          accessibilityLabel={`${label}: ${color}`}
          style={[
            styles.preview,
            { backgroundColor: color, borderColor: theme.palette.border },
          ]}
        />
        <AppInput
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={7}
          onChangeText={setDraft}
          onEndEditing={commit}
          onSubmitEditing={commit}
          value={draft}
        />
      </View>
      <View style={styles.presets}>
        {presets.map((preset) => (
          <Pressable
            accessibilityLabel={`اختيار اللون ${preset}`}
            accessibilityRole="button"
            key={preset}
            onPress={() => {
              setDraft(preset);
              setInvalid(false);
              onChange(preset);
            }}
            style={[
              styles.swatch,
              {
                backgroundColor: preset,
                borderColor:
                  preset === color
                    ? theme.palette.foreground
                    : theme.palette.border,
              },
            ]}
          />
        ))}
      </View>
      {invalid ? (
        <AppText color="danger" variant="caption">
          اكتب لوناً سداسياً كاملاً مثل #4caf50.
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inputRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  preview: {
    borderRadius: 10,
    borderWidth: 1,
    height: 48,
    width: 48,
  },
  root: {
    gap: 8,
  },
  swatch: {
    borderRadius: 14,
    borderWidth: 3,
    height: 28,
    width: 28,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Alignment/CompassClient.tsx (504 lines)
  confidence: high
  todos:      0
  notes:      Bounded hex input and accessible swatches replace the browser color input.
*/
