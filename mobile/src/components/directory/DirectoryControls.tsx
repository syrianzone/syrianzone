import { Grid2X2, List, Search, X } from 'lucide-react-native';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type TextStyle,
} from 'react-native';

import { AppInput } from '@/components/ui/AppInput';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';

export interface DirectoryOption<T extends string = string> {
  label: string;
  value: T;
}

interface DirectorySearchFieldProps {
  accessibilityLabel: string;
  clearAccessibilityLabel?: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  textAlign?: TextStyle['textAlign'];
  value: string;
}

export function DirectorySearchField({
  accessibilityLabel,
  clearAccessibilityLabel = 'مسح البحث',
  onChangeText,
  placeholder,
  textAlign,
  value,
}: DirectorySearchFieldProps) {
  const { theme } = useAppTheme();

  return (
    <View
      style={[
        styles.searchWrap,
        {
          backgroundColor: theme.palette.surface,
          borderColor: theme.palette.border,
        },
      ]}
    >
      <Search color={theme.palette.mutedForeground} size={19} />
      <AppInput
        accessibilityLabel={accessibilityLabel}
        onChangeText={onChangeText}
        placeholder={placeholder}
        returnKeyType="search"
        style={[styles.searchInput, textAlign ? { textAlign } : null]}
        value={value}
      />
      {value ? (
        <Pressable
          accessibilityLabel={clearAccessibilityLabel}
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => onChangeText('')}
        >
          <X color={theme.palette.mutedForeground} size={19} />
        </Pressable>
      ) : null}
    </View>
  );
}

interface DirectoryFilterChipsProps<T extends string> {
  direction?: 'ltr' | 'rtl';
  label?: string;
  onSelect: (value: T) => void;
  options: readonly DirectoryOption<T>[];
  selected: T;
}

export function DirectoryFilterChips<T extends string>({
  direction = 'rtl',
  label,
  onSelect,
  options,
  selected,
}: DirectoryFilterChipsProps<T>) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.filterGroup}>
      {label ? <AppText color="muted" variant="caption">{label}</AppText> : null}
      <ScrollView
        contentContainerStyle={styles.chips}
        horizontal
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
      >
        <View
          style={[
            styles.chips,
            { flexDirection: direction === 'rtl' ? 'row-reverse' : 'row' },
          ]}
        >
          {options.map((option) => {
            const active = selected === option.value;
            return (
              <Pressable
                accessibilityLabel={option.label}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                key={option.value}
                onPress={() => onSelect(option.value)}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: active
                      ? theme.palette.primary
                      : theme.palette.surface,
                    borderColor: active
                      ? theme.palette.primary
                      : theme.palette.border,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <AppText
                  style={{
                    color: active
                      ? theme.palette.primaryForeground
                      : theme.palette.foreground,
                  }}
                  variant="caption"
                >
                  {option.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

interface DirectoryViewToggleProps<T extends string> {
  first: DirectoryOption<T>;
  onChange: (value: T) => void;
  second: DirectoryOption<T>;
  value: T;
}

export function DirectoryViewToggle<T extends string>({
  first,
  onChange,
  second,
  value,
}: DirectoryViewToggleProps<T>) {
  return (
    <View style={styles.toggleRow}>
      <ToggleButton
        active={value === first.value}
        icon="grid"
        label={first.label}
        onPress={() => onChange(first.value)}
      />
      <ToggleButton
        active={value === second.value}
        icon="list"
        label={second.label}
        onPress={() => onChange(second.value)}
      />
    </View>
  );
}

function ToggleButton({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: 'grid' | 'list';
  label: string;
  onPress: () => void;
}) {
  const { theme } = useAppTheme();
  const color = active
    ? theme.palette.primaryForeground
    : theme.palette.foreground;
  const Icon = icon === 'grid' ? Grid2X2 : List;

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.toggle,
        {
          backgroundColor: active
            ? theme.palette.primary
            : theme.palette.surface,
          borderColor: active ? theme.palette.primary : theme.palette.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Icon color={color} size={icon === 'grid' ? 17 : 18} />
      <AppText style={{ color }} variant="caption">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chips: {
    alignItems: 'center',
    gap: 8,
  },
  filterGroup: {
    gap: 6,
  },
  searchInput: {
    borderWidth: 0,
    flex: 1,
    minHeight: 46,
    paddingHorizontal: 4,
  },
  searchWrap: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 8,
    overflow: 'hidden',
    paddingHorizontal: 12,
  },
  toggle: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  toggleRow: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
});
