import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';

import { routeColors } from '../_lib/mapColors';

export function RouteColorSelector({
  label = 'لون المسار على الخريطة',
  onChange,
  value,
}: {
  label?: string;
  onChange: (value: number) => void;
  value: number;
}) {
  const { theme } = useAppTheme();

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="radiogroup"
      style={styles.root}
    >
      <AppText variant="label">{label}</AppText>
      <View style={styles.options}>
        {routeColors.map((color, index) => {
          const checked = value === index;
          return (
            <Pressable
              accessibilityLabel={`لون المسار ${index + 1}`}
              accessibilityRole="radio"
              accessibilityState={{ checked }}
              hitSlop={4}
              key={color}
              onPress={() => onChange(index)}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: color,
                  borderColor: checked
                    ? theme.palette.foreground
                    : theme.palette.background,
                  opacity: pressed ? 0.7 : 1,
                },
                checked && styles.selected,
              ]}
            >
              <AppText style={styles.number} variant="caption">
                {index + 1}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  number: {
    color: '#ffffff',
    fontWeight: '700',
  },
  option: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 2,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  root: {
    gap: 8,
  },
  selected: {
    borderWidth: 4,
    transform: [{ scale: 1.08 }],
  },
});
